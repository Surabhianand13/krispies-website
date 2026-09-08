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
const { body, validationResult } = require('express-validator');
const db        = require('../db/database');
const { newOrderEmail, customerOrderConfirmationEmail } = require('../utils/email');
const { sendPurchaseEvent } = require('../utils/metaCapi');
const { optionalCustomerAuth, requireAuth } = require('../middleware/auth');
const { VALID_OUTLETS } = require('../utils/constants');
const { dbRateLimit } = require('../middleware/dbRateLimit');
const { verifyTurnstileToken } = require('../utils/turnstile');

const router = express.Router();

function notifyOrder(row) {
  newOrderEmail(row).catch(() => {});
  if (row.customer_email) customerOrderConfirmationEmail(row).catch(() => {});
}

/* ── Stricter rate limiter for payment endpoints ──
   Max 10 attempts per IP per 15 minutes.
   Prevents brute-force / automated fraud attempts. DB-backed (not
   express-rate-limit's in-memory store) since this runs across multiple
   instances that don't share process memory -- see middleware/dbRateLimit.js. */
const paymentLimiter = dbRateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  keyGenerator: (req) => `payment:${req.ip}`,
  message:  { error: 'Too many payment attempts. Please wait a few minutes and try again.' },
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

/* Test-checkout codes: minted only by an authenticated admin (see the
   /test-code route below), random, single-use, and expire in 15 minutes.
   Redeeming one at checkout needs no admin session -- possessing a
   currently-valid, unused, unexpired code is proof enough, since there's
   no way to produce one without already being logged into /admin/. This
   replaces an earlier fixed-string design (a hardcoded coupon gated on an
   admin JWT header) that, while not guessable by a guest, still sat as a
   permanent secret in source forever; a random code that expires and can
   only ever be spent once has a much smaller window to matter if it ever
   leaked. */
const TEST_CODE_PREFIX = 'TEST-';

function generateTestCode() {
  return TEST_CODE_PREFIX + crypto.randomBytes(4).toString('hex').toUpperCase();
}

/* Returns { amount: 1 } on a valid redemption, or { error } if the code
   looks like a test code but doesn't match a live one -- distinct from
   "not a test code at all", which the caller treats as an ordinary
   (possibly public) coupon lookup instead. */
function redeemTestCode(code) {
  db.prepare(`DELETE FROM test_checkout_codes WHERE expires_at < datetime('now')`).run();
  const row = db.prepare(`SELECT * FROM test_checkout_codes WHERE code = ? AND used = 0 AND expires_at > datetime('now')`).get(code);
  if (!row) return { error: 'This test code is invalid, expired, or already used. Generate a new one from the admin dashboard.' };
  db.prepare('UPDATE test_checkout_codes SET used = 1 WHERE code = ?').run(code);
  return { amount: MIN_AMOUNT };
}

/* ── Shared validators ── */
const MIN_AMOUNT = 1;          // ₹1 — absolute floor
const MAX_AMOUNT = 500000;     // ₹5,00,000 — ceiling against inflated payloads

const MAX_CART_ITEMS = 20; // sanity ceiling against a malformed/abusive payload

const orderValidators = [
  body('customer_name').trim().notEmpty().withMessage('Name is required.'),
  body('customer_phone').trim().notEmpty().withMessage('Phone number is required.'),
  body('items').trim().notEmpty().withMessage('Items are required.'),
  // A request is either a single-item order (product_id) or a multi-item
  // cart order (cart_items, a non-empty array) -- computeAuthoritativeAmount
  // treats both shapes identically by normalizing product_id into a
  // one-element item list.
  body().custom((_, { req }) => {
    const b = req.body;
    if (b.product_id && String(b.product_id).trim()) return true;
    if (Array.isArray(b.cart_items) && b.cart_items.length > 0 && b.cart_items.length <= MAX_CART_ITEMS) return true;
    throw new Error(`Product is required (or between 1 and ${MAX_CART_ITEMS} cart items).`);
  }),
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
  const disc = Number(product.discount) || 0;
  // Same discount field used for the no-variant case below now also applies
  // on top of each variant option's own "sticker" price -- must mirror
  // products.js's toProduct() exactly, since that's what the customer sees
  // displayed; this is what actually gets charged.
  const applyDiscount = (price) => disc ? Math.round(price * (1 - disc / 100)) : price;

  let groups = [];
  try { groups = JSON.parse(product.variant_groups || '[]'); } catch (_) { groups = []; }

  if (!Array.isArray(groups) || !groups.length) {
    const mrp = Number(product.mrp) || 0;
    return mrp ? applyDiscount(mrp) : 0;
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
    return sum + (opt ? applyDiscount(Number(opt.price) || 0) : 0);
  }, 0);
}

/* Prices one line item authoritatively: real product row, real variant
   pricing, real add-on rows (never the client's own price/label for any of
   these). An add-on id that doesn't exist or isn't active is skipped rather
   than failing the whole order -- worst case the customer is undercharged
   for a garnish that's gone stale in their browser's cache, which is far
   better than blocking a real cake order over it. Returns null if the
   product itself doesn't exist -- that one *does* fail the order, since an
   order for a product that isn't real can't be priced at all. */
function computeItemSubtotal(item) {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item && item.product_id);
  if (!product) return null;

  const qty = Math.max(1, Math.min(99, parseInt(item.quantity, 10) || 1));
  let total = computeUnitPrice(product, item.variant_selection) * qty;

  if (Array.isArray(item.addons)) {
    for (const a of item.addons) {
      const addon = db.prepare('SELECT * FROM addons WHERE id = ? AND active = 1').get(a && a.id);
      if (!addon) continue;
      const addonQty = Math.max(1, Math.min(99, parseInt(a.quantity, 10) || 1));
      total += (Number(addon.price) || 0) * addonQty;
    }
  }
  return total;
}

/* Returns { amount, error }. error is set (and amount null) when the
   request can't be priced safely -- caller should respond 400.

   A single-item order (product_id/quantity/variant_selection/addons at the
   top level) and a multi-item cart order (cart_items, an array of the same
   shape) are priced through the same loop -- the former is just normalized
   into a one-element list of the latter, so there's exactly one code path
   that decides what a customer is actually charged regardless of which UI
   flow (Buy Now vs. Add to Cart) produced the request.

   A coupon_code starting with TEST- is never a real public coupon (see
   redeemTestCode above) -- it forces the real, live Razorpay flow (order
   creation, checkout dialog, HMAC verify, DB update, emails -- everything
   /initiate and /verify actually do) to run end-to-end for MIN_AMOUNT
   instead of the product's real price, so the payment pipeline itself can
   be confirmed working without spending a real order's worth of money on
   every test. An invalid/expired/reused TEST- code fails loudly here
   rather than silently falling back to full price, so a test run doesn't
   accidentally become a real charge without anyone noticing. */
function computeAuthoritativeAmount(body) {
  const items = Array.isArray(body.cart_items) && body.cart_items.length
    ? body.cart_items
    : [{ product_id: body.product_id, quantity: body.quantity, variant_selection: body.variant_selection, addons: body.addons }];

  if (items.length > MAX_CART_ITEMS) {
    return { amount: null, error: `Orders are limited to ${MAX_CART_ITEMS} items — please split into more than one order or call us.` };
  }

  let subtotal = 0;
  for (const item of items) {
    const itemTotal = computeItemSubtotal(item);
    if (itemTotal === null) {
      return { amount: null, error: 'This item is no longer available — please refresh the page and try again.' };
    }
    subtotal += itemTotal;
  }

  const mode = body.delivery_mode === 'pickup' ? 'pickup' : 'delivery';
  let fee = 0;
  if (mode === 'delivery') {
    fee = Number(body.delivery_fee);
    if (!DELIVERY_FEE_TIERS.includes(fee)) {
      return { amount: null, error: 'Invalid delivery fee — please redo checkout.' };
    }
  }

  const code = String(body.coupon_code || '').trim().toUpperCase();
  if (code.startsWith(TEST_CODE_PREFIX)) {
    const result = redeemTestCode(code);
    return { amount: result.amount ?? null, error: result.error ?? null };
  }

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
    // For a cart order, quantity is the total unit count across every item
    // (there's no single "the" quantity once more than one product's involved).
    quantity:       Array.isArray(body.cart_items) && body.cart_items.length
                      ? String(body.cart_items.reduce((s, i) => s + (parseInt(i.quantity, 10) || 1), 0))
                      : (body.quantity || null),
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
   POST /api/checkout/test-code  — admin-only
   Mints a fresh TEST- code (see redeemTestCode above). Not rate-limited
   with paymentLimiter -- requireAuth already means only a logged-in admin
   can call this at all, and each code is one-time-use regardless of how
   many are generated.
   ════════════════════════════════════════════════ */
router.post('/test-code', requireAuth, (req, res) => {
  const code = generateTestCode();
  const expiresInMinutes = 15;
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();
  db.prepare('INSERT INTO test_checkout_codes (code, expires_at) VALUES (?, ?)').run(code, expiresAt);
  res.json({ code, expiresInMinutes });
});

/* ════════════════════════════════════════════════
   POST /api/checkout/initiate  — Razorpay order
   ════════════════════════════════════════════════ */
router.post('/initiate', paymentLimiter, optionalCustomerAuth, orderValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const turnstileResult = await verifyTurnstileToken(req);
  if (turnstileResult) return res.status(turnstileResult.status).json({ error: turnstileResult.error });

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
