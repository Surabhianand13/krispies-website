'use strict';

/**
 * PUBLIC-facing customer account routes.
 *
 * POST /api/customers/signup      — create an account, auto-login, link any
 *                                    past guest orders placed under the same phone
 * POST /api/customers/login       — phone + password
 * POST /api/customers/otp/request — email OTP login/signup: send a code
 * POST /api/customers/otp/verify  — email OTP login/signup: check the code,
 *                                    auto-creating an account on first use
 * GET  /api/customers/me          — current profile (requires customer auth)
 * GET  /api/customers/orders      — this customer's order history
 */

const express   = require('express');
const crypto    = require('crypto');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { requireCustomerAuth, requireAuth } = require('../middleware/auth');
const { otpLoginEmail } = require('../utils/email');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter than authLimiter -- each hit sends a real email, so this also
// guards against using the login form to spam someone else's inbox.
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many code requests. Please wait a few minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function uid() {
  return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function otpId() {
  return 'otp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Deliberately a separate env var from the admin login's JWT_EXPIRES_IN --
// admin and customer sessions have very different risk profiles (admin JWT
// guards the whole panel; customer JWT lives in localStorage for a "stay
// logged in" shopping UX) and shouldn't be forced to the same lifetime.
function signCustomerToken(customer) {
  return jwt.sign(
    { type: 'customer', id: customer.id, name: customer.name, phone: customer.phone },
    process.env.JWT_SECRET,
    { expiresIn: process.env.CUSTOMER_JWT_EXPIRES_IN || '7d' }
  );
}

function toCustomer(row) {
  return { id: row.id, name: row.name, phone: row.phone, email: row.email, createdAt: row.created_at };
}

// ── POST /api/customers/signup ──────────────────────────────────────────────
router.post('/signup',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('phone').trim().isLength({ min: 7 }).withMessage('A valid phone number is required.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Please enter a valid email.'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const phone = req.body.phone.trim();
    const existing = db.prepare('SELECT id FROM customers WHERE phone = ?').get(phone);
    if (existing) return res.status(409).json({ error: 'An account with this phone number already exists. Please log in instead.' });

    const row = {
      id:            uid(),
      name:          req.body.name.trim(),
      phone,
      email:         req.body.email ? req.body.email.trim() : null,
      password_hash: bcrypt.hashSync(req.body.password, 12),
    };
    db.prepare('INSERT INTO customers (id, name, phone, email, password_hash) VALUES (@id, @name, @phone, @email, @password_hash)').run(row);

    // Retroactively link any guest orders placed under this phone number
    // before the account existed, so order history isn't left behind.
    db.prepare('UPDATE orders SET customer_id = ? WHERE customer_phone = ? AND customer_id IS NULL').run(row.id, phone);

    const token = signCustomerToken(row);
    res.status(201).json({ token, customer: toCustomer(row) });
  }
);

// ── POST /api/customers/login ───────────────────────────────────────────────
router.post('/login',
  authLimiter,
  [
    body('phone').trim().notEmpty().withMessage('Phone number is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(req.body.phone.trim());
    // password_hash is null for accounts created via email OTP that never
    // set a password -- bcrypt.compareSync throws on a non-string hash, so
    // that case must short-circuit to "invalid" rather than a 500.
    if (!customer || !customer.password_hash || !bcrypt.compareSync(req.body.password, customer.password_hash)) {
      return res.status(401).json({ error: 'Invalid phone number or password.' });
    }

    const token = signCustomerToken(customer);
    res.json({ token, customer: toCustomer(customer) });
  }
);

// ── POST /api/customers/otp/request ─────────────────────────────────────────
router.post('/otp/request',
  otpRequestLimiter,
  [ body('email').trim().isEmail().withMessage('Please enter a valid email.') ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const email = req.body.email.trim().toLowerCase();

    // Opportunistic cleanup of stale rows -- cheap, keeps the table small
    // without needing a separate scheduled job.
    db.prepare(`DELETE FROM email_otps WHERE expires_at < datetime('now')`).run();
    // Invalidate any still-live code for this email so only the latest one works.
    db.prepare('DELETE FROM email_otps WHERE email = ?').run(email);

    const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    db.prepare(`
      INSERT INTO email_otps (id, email, otp_hash, expires_at)
      VALUES (?, ?, ?, datetime('now', '+10 minutes'))
    `).run(otpId(), email, bcrypt.hashSync(otp, 10));

    otpLoginEmail(email, otp).catch(() => {});

    // Convenience for local development only -- there's no SMTP inbox to
    // check against a dev/test server, and this path never runs when
    // NODE_ENV=production (see render.yaml).
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] OTP for ${email}: ${otp}`);
    }

    res.json({ message: 'If that email is valid, a login code has been sent.' });
  }
);

// ── POST /api/customers/otp/verify ──────────────────────────────────────────
router.post('/otp/verify',
  authLimiter,
  [
    body('email').trim().isEmail().withMessage('Please enter a valid email.'),
    body('otp').trim().isLength({ min: 6, max: 6 }).isNumeric().withMessage('Enter the 6-digit code.'),
    body('name').optional({ checkFalsy: true }).trim(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const email = req.body.email.trim().toLowerCase();
    const otpRow = db.prepare(`
      SELECT * FROM email_otps
      WHERE email = ? AND consumed = 0 AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(email);

    if (!otpRow) {
      return res.status(400).json({ error: 'That code has expired or is invalid. Please request a new one.' });
    }
    if (otpRow.attempts >= 5) {
      db.prepare('UPDATE email_otps SET consumed = 1 WHERE id = ?').run(otpRow.id);
      return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new code.' });
    }
    if (!bcrypt.compareSync(req.body.otp, otpRow.otp_hash)) {
      db.prepare('UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?').run(otpRow.id);
      return res.status(400).json({ error: 'Incorrect code. Please try again.' });
    }

    // Don't mark the code consumed yet -- if this is a brand-new email and
    // no name was given, the customer needs to resubmit with a name using
    // this SAME code. Only burn it once we're actually about to log them
    // in or finish creating the account.
    let customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(email);
    if (!customer) {
      const name = (req.body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Please enter your name to create an account.', requiresName: true });

      const row = { id: uid(), name, phone: null, email, password_hash: null };
      db.prepare('INSERT INTO customers (id, name, phone, email, password_hash) VALUES (@id, @name, @phone, @email, @password_hash)').run(row);
      // Retroactively link any guest orders placed under this email before
      // the account existed, mirroring what /signup does by phone.
      db.prepare('UPDATE orders SET customer_id = ? WHERE customer_email = ? AND customer_id IS NULL').run(row.id, email);
      customer = row;
    }

    db.prepare('UPDATE email_otps SET consumed = 1 WHERE id = ?').run(otpRow.id);

    const token = signCustomerToken(customer);
    res.json({ token, customer: toCustomer(customer) });
  }
);

// ── GET /api/customers/me ────────────────────────────────────────────────────
router.get('/me', requireCustomerAuth, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.customer.id);
  if (!customer) return res.status(404).json({ error: 'Account not found.' });
  res.json(toCustomer(customer));
});

// ── GET /api/customers/orders ────────────────────────────────────────────────
router.get('/orders', requireCustomerAuth, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.customer.id);
  if (!customer) return res.status(404).json({ error: 'Account not found.' });

  // Match on customer_id (the normal path) as well as phone number, in case
  // an order was placed as a guest under this phone after the account
  // already existed but the checkout call didn't carry a token.
  const orders = db.prepare(
    'SELECT * FROM orders WHERE customer_id = ? OR customer_phone = ? ORDER BY created_at DESC'
  ).all(customer.id, customer.phone);

  res.json(orders);
});

// ── ADDRESS BOOK ─────────────────────────────────────────────────────────────
function toAddress(row) {
  return {
    id: row.id, label: row.label, name: row.name, phone: row.phone,
    line: row.line, city: row.city, pincode: row.pincode,
    isDefault: row.is_default === 1, createdAt: row.created_at,
  };
}
function addressId() { return 'a_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// GET /api/customers/addresses
router.get('/addresses', requireCustomerAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC'
  ).all(req.customer.id);
  res.json(rows.map(toAddress));
});

// POST /api/customers/addresses
router.post('/addresses',
  requireCustomerAuth,
  [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('phone').trim().isLength({ min: 7 }).withMessage('A valid phone number is required.'),
    body('line').trim().notEmpty().withMessage('Address is required.'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const row = {
      id: addressId(),
      customer_id: req.customer.id,
      label: (req.body.label || 'Home').trim(),
      name: req.body.name.trim(),
      phone: req.body.phone.trim(),
      line: req.body.line.trim(),
      city: (req.body.city || 'Hyderabad').trim(),
      pincode: req.body.pincode ? req.body.pincode.trim() : null,
      is_default: req.body.isDefault ? 1 : 0,
    };
    if (row.is_default) {
      db.prepare('UPDATE addresses SET is_default = 0 WHERE customer_id = ?').run(req.customer.id);
    }
    db.prepare(`
      INSERT INTO addresses (id, customer_id, label, name, phone, line, city, pincode, is_default)
      VALUES (@id, @customer_id, @label, @name, @phone, @line, @city, @pincode, @is_default)
    `).run(row);
    res.status(201).json(toAddress(db.prepare('SELECT * FROM addresses WHERE id = ?').get(row.id)));
  }
);

// PUT /api/customers/addresses/:id
router.put('/addresses/:id',
  requireCustomerAuth,
  [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('phone').trim().isLength({ min: 7 }).withMessage('A valid phone number is required.'),
    body('line').trim().notEmpty().withMessage('Address is required.'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const existing = db.prepare('SELECT id FROM addresses WHERE id = ? AND customer_id = ?').get(req.params.id, req.customer.id);
    if (!existing) return res.status(404).json({ error: 'Address not found.' });

    const row = {
      id: req.params.id,
      label: (req.body.label || 'Home').trim(),
      name: req.body.name.trim(),
      phone: req.body.phone.trim(),
      line: req.body.line.trim(),
      city: (req.body.city || 'Hyderabad').trim(),
      pincode: req.body.pincode ? req.body.pincode.trim() : null,
      is_default: req.body.isDefault ? 1 : 0,
    };
    if (row.is_default) {
      db.prepare('UPDATE addresses SET is_default = 0 WHERE customer_id = ?').run(req.customer.id);
    }
    db.prepare(`
      UPDATE addresses SET label=@label, name=@name, phone=@phone, line=@line, city=@city, pincode=@pincode, is_default=@is_default
      WHERE id=@id
    `).run(row);
    res.json(toAddress(db.prepare('SELECT * FROM addresses WHERE id = ?').get(req.params.id)));
  }
);

// DELETE /api/customers/addresses/:id
router.delete('/addresses/:id', requireCustomerAuth, (req, res) => {
  const existing = db.prepare('SELECT id FROM addresses WHERE id = ? AND customer_id = ?').get(req.params.id, req.customer.id);
  if (!existing) return res.status(404).json({ error: 'Address not found.' });
  db.prepare('DELETE FROM addresses WHERE id = ?').run(req.params.id);
  res.json({ message: 'Address deleted.' });
});

// ── ADMIN-ONLY routes below ──────────────────────────────────────────────────
// GET /api/customers -- list all accounts with an order count each
router.get('/', requireAuth, (_req, res) => {
  const rows = db.prepare(`
    SELECT c.*, COUNT(o.id) AS order_count
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all();
  res.json(rows.map(r => ({ ...toCustomer(r), orderCount: r.order_count })));
});

// DELETE /api/customers/:id -- e.g. to remove test/duplicate accounts
router.delete('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Account not found.' });
  db.prepare('UPDATE orders SET customer_id = NULL WHERE customer_id = ?').run(req.params.id);
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  res.json({ message: 'Account deleted.' });
});

module.exports = router;
