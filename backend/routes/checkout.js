'use strict';

/**
 * PUBLIC checkout routes — no auth required.
 *
 * POST /api/checkout           — place a Cash-on-Delivery / pay-at-store order
 * POST /api/checkout/initiate  — create a Razorpay order and return order details
 * POST /api/checkout/verify    — verify Razorpay payment signature and confirm order
 */

const express    = require('express');
const crypto     = require('crypto');
const rateLimit  = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const db         = require('../db/database');
const { newOrderEmail } = require('../utils/email');

const router = express.Router();

/* ── Rate limiter: 10 order attempts per hour per IP ── */
const checkoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many order attempts. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/* ── Razorpay — loaded lazily so the server starts even without the package ── */
function getRazorpay() {
  try {
    return require('razorpay');
  } catch (_) {
    return null;
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ── Shared validators ── */
const orderValidators = [
  body('customer_name').trim().notEmpty().withMessage('Name is required.'),
  body('customer_phone').trim().notEmpty().withMessage('Phone number is required.'),
  body('items').trim().notEmpty().withMessage('Items are required.'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0.'),
];

/* ── Build DB row from request body ── */
function buildOrderRow(body, extra = {}) {
  const noteParts = [
    body.delivery_mode    ? `Mode: ${body.delivery_mode}`           : '',
    body.delivery_address ? `Address: ${body.delivery_address}`     : '',
    body.payment_method   ? `Payment: ${body.payment_method}`       : '',
    body.notes            ? body.notes                               : '',
  ].filter(Boolean);

  return {
    id:             uid(),
    customer_name:  body.customer_name.trim(),
    customer_phone: body.customer_phone.trim(),
    items:          body.items.trim(),
    quantity:       body.quantity  || null,
    amount:         parseFloat(body.amount),
    platform:       'website',
    outlet:         body.outlet    || null,
    order_date:     new Date().toISOString().split('T')[0],
    delivery_date:  body.delivery_date || null,
    status:         'pending',
    notes:          noteParts.join(' | ') || null,
    ...extra,
  };
}

const INSERT_SQL = `
  INSERT INTO orders
    (id, customer_name, customer_phone, items, quantity, amount,
     platform, outlet, order_date, delivery_date, status, notes)
  VALUES
    (@id, @customer_name, @customer_phone, @items, @quantity, @amount,
     @platform, @outlet, @order_date, @delivery_date, @status, @notes)
`;

/* ════════════════════════════════════════════════
   POST /api/checkout   — Cash on Delivery order
   ════════════════════════════════════════════════ */
router.post('/', checkoutLimiter, orderValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const row = buildOrderRow(req.body);
  db.prepare(INSERT_SQL).run(row);

  // Fire email notification (non-blocking)
  newOrderEmail(row).catch(() => {});

  res.status(201).json({
    success: true,
    orderId: row.id,
    message: 'Order placed successfully.',
  });
});

/* ════════════════════════════════════════════════
   POST /api/checkout/initiate  — Razorpay order
   ════════════════════════════════════════════════ */
router.post('/initiate', checkoutLimiter, orderValidators, async (req, res) => {
  const Razorpay = getRazorpay();
  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!Razorpay || !keyId || !keySecret) {
    return res.status(503).json({
      error: 'Online payment is not configured yet. Please use Cash on Delivery.',
    });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  // Amount comes in rupees from the frontend → convert to paise
  const amountPaise = Math.round(parseFloat(req.body.amount) * 100);

  // Save a PENDING order first so we have an internal ID to track
  const row = buildOrderRow(req.body);
  db.prepare(INSERT_SQL).run(row);

  try {
    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

    const rzpOrder = await rzp.orders.create({
      amount:   amountPaise,
      currency: 'INR',
      receipt:  row.id,           // our internal order id
      notes: {
        customer: req.body.customer_name,
        items:    req.body.items,
        outlet:   req.body.outlet || '',
      },
    });

    // Stamp the Razorpay order ID into the notes for traceability
    db.prepare(`UPDATE orders SET notes = '[RZP:' || ? || '] ' || COALESCE(notes,'') WHERE id = ?`)
      .run(rzpOrder.id, row.id);

    return res.json({
      razorpay_order_id: rzpOrder.id,
      internal_order_id: row.id,
      amount:            amountPaise,   // paise — Razorpay SDK expects paise
      currency:          'INR',
      key_id:            keyId,
    });

  } catch (err) {
    console.error('[Razorpay] initiate error:', err.message || err);
    // Remove the orphan pending order we created above
    db.prepare('DELETE FROM orders WHERE id = ?').run(row.id);
    return res.status(500).json({
      error: 'Payment initiation failed. Please use Cash on Delivery.',
    });
  }
});

/* ════════════════════════════════════════════════
   POST /api/checkout/verify  — Signature check
   ════════════════════════════════════════════════ */
router.post('/verify', (req, res) => {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return res.status(503).json({ error: 'Payment verification not configured.' });
  }

  const {
    internal_order_id,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;

  if (!internal_order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment verification fields.' });
  }

  // Razorpay signature = HMAC-SHA256( order_id + "|" + payment_id, key_secret )
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expected !== razorpay_signature) {
    return res.status(400).json({ error: 'Payment signature verification failed.' });
  }

  // Mark the order as confirmed
  db.prepare(`UPDATE orders SET status = 'confirmed', updated_at = datetime('now') WHERE id = ?`)
    .run(internal_order_id);

  const confirmedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(internal_order_id);
  if (confirmedOrder) newOrderEmail(confirmedOrder).catch(() => {});

  res.json({ success: true, message: 'Payment verified. Order confirmed.' });
});

module.exports = router;
