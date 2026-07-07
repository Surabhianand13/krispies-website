'use strict';

/**
 * PUBLIC-facing customer account routes.
 *
 * POST /api/customers/signup — create an account, auto-login, link any past
 *                               guest orders placed under the same phone
 * POST /api/customers/login  — phone + password
 * GET  /api/customers/me     — current profile (requires customer auth)
 * GET  /api/customers/orders — this customer's order history
 */

const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { requireCustomerAuth } = require('../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function uid() {
  return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function signCustomerToken(customer) {
  return jwt.sign(
    { type: 'customer', id: customer.id, name: customer.name, phone: customer.phone },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
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
    if (!customer || !bcrypt.compareSync(req.body.password, customer.password_hash)) {
      return res.status(401).json({ error: 'Invalid phone number or password.' });
    }

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

module.exports = router;
