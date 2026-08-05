'use strict';

/**
 * PUBLIC checkout routes — no auth required.
 *
 * POST /api/checkout           — disabled; Cash on Delivery is no longer offered
 * POST /api/checkout/initiate  — create a Razorpay order and return order details
 * POST /api/checkout/verify    — verify Razorpay payment signature and confirm order
 */

const express   = require('express');
const crypto    = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const db        = require('../db/database');
const { newOrderEmail, customerOrderConfirmationEmail } = require('../utils/email');
const { sendPurchaseEvent } = require('../utils/metaCapi');
const { optionalCustomerAuth } = require('../middleware/auth');
const { VALID_OUTLETS } = require('../utils/constants');

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
  body('product_id').trim().notEmpty().withMessage('Product is required.'),
  body('outlet').optional({ checkFalsy: true }).isIn(VALID_OUTLETS).withMessage('Invalid outlet.'),
  body('delivery_mode').optional({ checkFalsy: true }).isIn(['pickup', 'delivery']).withMessage('Invalid delivery mode.'),
  body('amount')
    .isFloat({ min: MIN_AMOUNT, max: MAX_AMOUNT })
    .withMessage(`Amount must be between ₹${MIN_AMOUNT} and ₹${MAX_AMOUNT.toLocaleString('en-IN')}.`),
];

/* ── Authoritative price recompute ──
   The frontend sends `amount` for display purposes only. Every real order
   total is recomputed here from the product's own DB row (mirrors
   js/shop.js's productFinalPrice/productBasePrice) plus a server-side copy
   of coupons and delivery-fee tiers, so nothing the client sends -- a
   tampered amount, a bogus coupon_discount, or a made-up delivery fee --
   can change what actually gets charged. */
const COUPONS = {
  FIRST100: { off: 100, minOrder: 500 },
};
// 0 is deliberately excluded -- that's only ever legitimate for pickup
// (handled by the separate mode branch below), never for real delivery.
// Including it here would let a delivery-mode order pass validation with
// no delivery fee at all.
const DELIVERY_FEE_TIERS = [30, 60, 100, 150, 200, 250];

function computeUnitPrice(product, variantSelection) {
  let groups = [];
  try { groups = JSON.parse(product.variant_groups || '[]'); } catch (_) { groups = []; }

  if (!Array.isArray(groups) || !groups.length) {
    const mrp = Number(product.mrp) || 0;
    const disc = Number(product.discount) || 0;
    return mrp ? Math.round(mrp * (1 - disc / 100)) : 0;
  }

  const sel = (variantSelection && typeof variantSelection === 'object') ? variantSelection : {};
  return groups.reduce((sum, g) => {
    if (!Array.isArray(g.options) || !g.options.length) return sum;

    let idx = sel[g.name] != null ? Number(sel[g.name]) : (g.optional ? -1 : 0);
    const isValidIdx = Number.isInteger(idx) && idx >= 0 && idx < g.options.length;

    // A mandatory group can never legitimately contribute ₹0 -- the client
    // shouldn't be able to skip pricing it at all. -1 is only a real "skip"
    // for an *optional* group; for a mandatory one, -1 (or an out-of-range
    // index, or NaN from a non-numeric value) all fall back to the
    // cheapest real option instead of silently zeroing this group out.
    // (This was previously exploitable: a crafted variant_selection could
    // collapse a real product's price down to the ₹1 absolute-floor clamp.)
    if (!isValidIdx) {
      if (g.optional) return sum;
      idx = g.options.reduce((cheapestIdx, opt, i) =>
        (Number(opt.price) || 0) < (Number(g.options[cheapestIdx].price) || 0) ? i : cheapestIdx, 0);
    }

    const opt = g.options[idx];
    return sum + (opt ? Number(opt.price) || 0 : 0);
  }, 0);
}

/* Returns { amount, error }. error is set (and amount null) when the
   request can't be priced safely -- caller should respond 400. */
function computeAuthoritativeAmount(body) {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(body.product_id);
  if (!product) return { amount: null, error: 'Product not found.' };

  const qty = Math.max(1, Math.min(99, parseInt(body.quantity, 10) || 1));
  const unitPrice = computeUnitPrice(product, body.variant_selection);
  const subtotal = unitPrice * qty;

  const mode = body.delivery_mode === 'pickup' ? 'pickup' : 'delivery';
  let fee = 0;
  if (mode === 'delivery') {
    fee = Number(body.delivery_fee);
    if (!DELIVERY_FEE_TIERS.includes(fee)) {
      return { amount: null, error: 'Invalid delivery fee — please redo checkout.' };
    }
  }

  const code = String(body.coupon_code || '').trim().toUpperCase();
  const coupon = COUPONS[code];
  const discount = (coupon && subtotal >= coupon.minOrder) ? coupon.off : 0;

  const total = Math.max(MIN_AMOUNT, Math.round(subtotal + fee - discount));
  return { amount: total, error: null };
}

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

// ── Per-phone order rate limit ──
// Separate from paymentLimiter (which keys off IP): this catches the same
// phone number retrying across different devices/IPs/networks, and caps
// real order volume per customer regardless of how the per-IP window lines
// up. Counts all orders (any status) in the last hour, since the concern is
// repeated checkout abuse, not just successfully confirmed ones.
const MAX_ORDERS_PER_PHONE_PER_HOUR = 2;
function checkPhoneOrderLimit(phone) {
  const { c } = db.prepare(`
    SELECT COUNT(*) as c FROM orders
    WHERE customer_phone = ? AND created_at >= datetime('now', '-1 hour')
  `).get(phone);
  if (c >= MAX_ORDERS_PER_PHONE_PER_HOUR) {
    return { ok: false, error: 'Too many orders from this phone number in the last hour. Please wait a bit, or call us to place your order.' };
  }
  return { ok: true };
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
   POST /api/checkout   — DISABLED: Cash on Delivery is no longer offered.
   The route is kept (rather than removed) so old/cached frontend builds and
   direct API callers get a clear, honest error instead of a generic 404 --
   every order must go through /api/checkout/initiate + /verify (Razorpay).
   ════════════════════════════════════════════════ */
router.post('/', paymentLimiter, (_req, res) => {
  res.status(410).json({
    error: 'Cash on Delivery is no longer available. Please pay online to place your order.',
  });
});

/* ════════════════════════════════════════════════
   POST /api/checkout/initiate  — Razorpay order
   ════════════════════════════════════════════════ */
router.post('/initiate', paymentLimiter, optionalCustomerAuth, orderValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const phoneLimit = checkPhoneOrderLimit(req.body.customer_phone.trim());
  if (!phoneLimit.ok) return res.status(429).json({ error: phoneLimit.error });

  const Razorpay = getRazorpay();
  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!Razorpay || !keyId || !keySecret) {
    return res.status(503).json({
      error: 'Online payment is temporarily unavailable. Please try again shortly or call us to place your order.',
    });
  }

  const { amount, error: priceError } = computeAuthoritativeAmount(req.body);
  if (priceError) return res.status(400).json({ error: priceError });
  req.body.amount = amount;

  // Amount comes in rupees → convert to paise
  const amountPaise = Math.round(amount * 100);

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

    // Store the Razorpay order ID against this specific internal order --
    // /verify requires an exact match on this before ever checking a
    // signature, so a signature can only ever confirm the order it was
    // actually issued for (see /verify for why this matters).
    db.prepare(`UPDATE orders SET razorpay_order_id = ?, notes = '[RZP:' || ? || '] ' || COALESCE(notes,'') WHERE id = ?`)
      .run(rzpOrder.id, rzpOrder.id, row.id);

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
      error: 'Payment initiation failed. Please try again or call us to place your order.',
    });
  }
});

/* ════════════════════════════════════════════════
   POST /api/checkout/verify  — Signature check
   ════════════════════════════════════════════════ */
router.post('/verify',
  paymentLimiter,
  [
    body('internal_order_id').isString().trim().notEmpty(),
    body('razorpay_order_id').isString().trim().notEmpty(),
    body('razorpay_payment_id').isString().trim().notEmpty(),
    body('razorpay_signature').isString().trim().notEmpty(),
  ],
  (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid payment data.' });

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

  // Validate internal_order exists in DB before doing anything else
  const existingOrder = db.prepare('SELECT id, status, razorpay_order_id FROM orders WHERE id = ?').get(internal_order_id);
  if (!existingOrder) {
    console.warn('[Razorpay] Verify called with unknown internal_order_id:', internal_order_id);
    return res.status(400).json({ error: 'Order not found.' });
  }

  // Prevent replay: if already confirmed, return success without re-processing
  if (existingOrder.status === 'confirmed') {
    return res.json({ success: true, message: 'Order already confirmed.' });
  }

  // Only a still-pending order can ever become confirmed here -- e.g. an
  // order an admin has already cancelled shouldn't be resurrectable by a
  // late/replayed verify call.
  if (existingOrder.status !== 'pending') {
    return res.status(400).json({ error: `This order is ${existingOrder.status} and can no longer be confirmed.` });
  }

  // A valid HMAC signature only proves that *some* real payment happened
  // for the given razorpay_order_id + razorpay_payment_id pair -- it says
  // nothing on its own about which internal order that payment was for.
  // Without this check, a signature from any real payment (even the
  // cheapest item on the site) could be replayed against any other pending
  // internal_order_id to confirm it for free. Requiring the submitted
  // razorpay_order_id to match the one this internal order actually got
  // from /initiate ties the payment to *this* order specifically.
  if (existingOrder.razorpay_order_id !== razorpay_order_id) {
    console.warn('[Razorpay] razorpay_order_id mismatch for internal_order_id:', internal_order_id);
    return res.status(400).json({ error: 'Payment does not match this order.' });
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
  if (confirmedOrder) {
    notifyOrder(confirmedOrder);
    sendPurchaseEvent(confirmedOrder, req).catch(() => {});
  }

  res.json({ success: true, message: 'Payment verified. Order confirmed.' });
});

module.exports = router;
