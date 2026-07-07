'use strict';

/**
 * PUBLIC checkout routes — no auth required.
 *
 * POST /api/checkout           — place a Cash-on-Delivery / pay-at-store order
 * POST /api/checkout/initiate  — create a Razorpay order and return order details
 * POST /api/checkout/verify    — verify Razorpay payment signature and confirm order
 */

const express   = require('express');
const crypto    = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const db        = require('../db/database');
const { newOrderEmail, customerOrderConfirmationEmail } = require('../utils/email');
const { optionalCustomerAuth } = require('../middleware/auth');

const router = express.Router();

function notifyOrder(row) {
  newOrderEmail(row).catch(() => {});
  if (row.customer_email) customerOrderConfirmationEmail(row).catch(() => {});
}

/* ── Stricter rate limiter for payment endpoints ──
   Max 10 attempts per IP per 15 minutes.
   Prevents brute-force / automated fraud attempts.   */
const paymentLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many payment attempts. Please wait a few minutes and try again.' },
  skip: (req) => process.env.NODE_ENV === 'test',
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
const MIN_AMOUNT = 1;          // ₹1 — absolute floor
const MAX_AMOUNT = 500000;     // ₹5,00,000 — ceiling against inflated payloads

const orderValidators = [
  body('customer_name').trim().notEmpty().withMessage('Name is required.'),
  body('customer_phone').trim().notEmpty().withMessage('Phone number is required.'),
  body('items').trim().notEmpty().withMessage('Items are required.'),
  body('amount')
    .isFloat({ min: MIN_AMOUNT, max: MAX_AMOUNT })
    .withMessage(`Amount must be between ₹${MIN_AMOUNT} and ₹${MAX_AMOUNT.toLocaleString('en-IN')}.`),
];

/* ── Build DB row from request body ──
   req is optional -- when passed, an already-logged-in customer (detected
   by optionalCustomerAuth) gets their order linked automatically; guests
   still check out fine with customer_id left null. */
function buildOrderRow(body, extra = {}, req = null) {
  const noteParts = [
    body.delivery_mode    ? `Mode: ${body.delivery_mode}`           : '',
    body.delivery_address ? `Address: ${body.delivery_address}`     : '',
    body.payment_method   ? `Payment: ${body.payment_method}`       : '',
    body.notes            ? body.notes                               : '',
  ].filter(Boolean);

  // A guest can still be a returning customer -- match by phone even
  // without a token so their order history stays complete either way.
  let customerId = req?.customer?.id || null;
  if (!customerId && body.customer_phone) {
    const match = db.prepare('SELECT id FROM customers WHERE phone = ?').get(body.customer_phone.trim());
    if (match) customerId = match.id;
  }

  return {
    id:             uid(),
    customer_id:    customerId,
    customer_name:  body.customer_name.trim(),
    customer_phone: body.customer_phone.trim(),
    customer_email: body.customer_email ? String(body.customer_email).trim() : null,
    items:          body.items.trim(),
    quantity:       body.quantity  || null,
    amount:         parseFloat(body.amount),
    platform:       'website',
    outlet:         body.outlet    || null,
    order_date:     new Date().toISOString().split('T')[0],
    delivery_date:  body.delivery_date || null,
    status:         'pending',
    payment_method: body.payment_method || null,
    notes:          noteParts.join(' | ') || null,
    ...extra,
  };
}

const INSERT_SQL = `
  INSERT INTO orders
    (id, customer_id, customer_name, customer_phone, customer_email, items, quantity, amount,
     platform, outlet, order_date, delivery_date, status, payment_method, notes)
  VALUES
    (@id, @customer_id, @customer_name, @customer_phone, @customer_email, @items, @quantity, @amount,
     @platform, @outlet, @order_date, @delivery_date, @status, @payment_method, @notes)
`;

/* ════════════════════════════════════════════════
   POST /api/checkout   — Cash on Delivery order
   ════════════════════════════════════════════════ */
router.post('/', paymentLimiter, optionalCustomerAuth, orderValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const row = buildOrderRow(req.body, {}, req);
  db.prepare(INSERT_SQL).run(row);

  // Fire email notifications (non-blocking) -- admin always, customer only
  // if they gave an email address.
  notifyOrder(row);

  res.status(201).json({
    success: true,
    orderId: row.id,
    message: 'Order placed successfully.',
  });
});

/* ════════════════════════════════════════════════
   POST /api/checkout/initiate  — Razorpay order
   ════════════════════════════════════════════════ */
router.post('/initiate', paymentLimiter, optionalCustomerAuth, orderValidators, async (req, res) => {
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
  const row = buildOrderRow(req.body, {}, req);
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
router.post('/verify', paymentLimiter, (req, res) => {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    // Log server-side but never expose config details to caller
    console.error('[Razorpay] RAZORPAY_KEY_SECRET is not set.');
    return res.status(503).json({ error: 'Payment service unavailable.' });
  }

  const {
    internal_order_id,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;

  if (!internal_order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Invalid payment data.' });
  }

  // Validate internal_order exists in DB before doing anything else
  const existingOrder = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(internal_order_id);
  if (!existingOrder) {
    console.warn('[Razorpay] Verify called with unknown internal_order_id:', internal_order_id);
    return res.status(400).json({ error: 'Order not found.' });
  }

  // Prevent replay: if already confirmed, return success without re-processing
  if (existingOrder.status === 'confirmed') {
    return res.json({ success: true, message: 'Order already confirmed.' });
  }

  // Razorpay signature = HMAC-SHA256( order_id + "|" + payment_id, key_secret )
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  // Constant-time comparison prevents timing attacks
  const sigBuffer      = Buffer.from(razorpay_signature, 'hex');
  const expectedBuffer = Buffer.from(expected,            'hex');
  const signaturesMatch =
    sigBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(sigBuffer, expectedBuffer);

  if (!signaturesMatch) {
    console.warn('[Razorpay] Signature mismatch for order:', internal_order_id);
    return res.status(400).json({ error: 'Payment could not be verified.' });
  }

  // Mark the order as confirmed
  db.prepare(`UPDATE orders SET status = 'confirmed', updated_at = datetime('now') WHERE id = ?`)
    .run(internal_order_id);

  const confirmedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(internal_order_id);
  if (confirmedOrder) notifyOrder(confirmedOrder);

  res.json({ success: true, message: 'Payment verified. Order confirmed.' });
});

module.exports = router;
