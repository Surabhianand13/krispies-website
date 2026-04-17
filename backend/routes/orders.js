'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { newOrderEmail } = require('../utils/email');

const router = express.Router();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// All order routes require auth
router.use(requireAuth);

// GET /api/orders
router.get('/', (req, res) => {
  const { status, platform, outlet, search } = req.query;
  let sql   = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (status)   { sql += ' AND status = ?';           params.push(status); }
  if (platform) { sql += ' AND platform = ?';         params.push(platform); }
  if (outlet)   { sql += ' AND outlet = ?';           params.push(outlet); }
  if (search)   {
    sql += ' AND (customer_name LIKE ? OR customer_phone LIKE ? OR items LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params).map(toOrder));
});

// GET /api/orders/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Order not found.' });
  res.json(toOrder(row));
});

// POST /api/orders
router.post('/',
  [
    body('customer_name').trim().notEmpty().withMessage('Customer name is required.'),
    body('items').trim().notEmpty().withMessage('Items are required.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const o = {
      id:             uid(),
      customer_name:  req.body.customer_name.trim(),
      customer_phone: (req.body.customer_phone || '').trim() || null,
      items:          req.body.items.trim(),
      quantity:       (req.body.quantity || '').trim() || null,
      amount:         req.body.amount ? parseFloat(req.body.amount) : null,
      platform:       req.body.platform || null,
      outlet:         req.body.outlet || null,
      order_date:     req.body.order_date || null,
      delivery_date:  req.body.delivery_date || null,
      status:         req.body.status || 'pending',
      notes:          (req.body.notes || '').trim() || null,
    };

    db.prepare(`
      INSERT INTO orders
        (id, customer_name, customer_phone, items, quantity, amount, platform,
         outlet, order_date, delivery_date, status, notes)
      VALUES
        (@id, @customer_name, @customer_phone, @items, @quantity, @amount, @platform,
         @outlet, @order_date, @delivery_date, @status, @notes)
    `).run(o);

    const created = toOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(o.id));

    // Fire-and-forget email
    newOrderEmail(o).catch(() => {});

    res.status(201).json(created);
  }
);

// PUT /api/orders/:id
router.put('/:id',
  [
    body('customer_name').trim().notEmpty().withMessage('Customer name is required.'),
    body('items').trim().notEmpty().withMessage('Items are required.'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const existing = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Order not found.' });

    db.prepare(`
      UPDATE orders
      SET customer_name = @customer_name, customer_phone = @customer_phone,
          items = @items, quantity = @quantity, amount = @amount,
          platform = @platform, outlet = @outlet, order_date = @order_date,
          delivery_date = @delivery_date, status = @status, notes = @notes,
          updated_at = datetime('now')
      WHERE id = @id
    `).run({
      id:             req.params.id,
      customer_name:  req.body.customer_name.trim(),
      customer_phone: (req.body.customer_phone || '').trim() || null,
      items:          req.body.items.trim(),
      quantity:       (req.body.quantity || '').trim() || null,
      amount:         req.body.amount ? parseFloat(req.body.amount) : null,
      platform:       req.body.platform || null,
      outlet:         req.body.outlet || null,
      order_date:     req.body.order_date || null,
      delivery_date:  req.body.delivery_date || null,
      status:         req.body.status || 'pending',
      notes:          (req.body.notes || '').trim() || null,
    });

    res.json(toOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)));
  }
);

// PATCH /api/orders/:id/status
router.patch('/:id/status',
  [body('status').notEmpty().withMessage('Status is required.')],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const existing = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Order not found.' });

    db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(req.body.status, req.params.id);

    res.json(toOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)));
  }
);

// DELETE /api/orders/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Order not found.' });
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ message: 'Order deleted.' });
});

// ── Helper ─────────────────────────────────────────────────────────────────────
function toOrder(row) {
  return {
    id:            row.id,
    customerName:  row.customer_name,
    customerPhone: row.customer_phone,
    items:         row.items,
    quantity:      row.quantity,
    amount:        row.amount,
    platform:      row.platform,
    outlet:        row.outlet,
    orderDate:     row.order_date,
    deliveryDate:  row.delivery_date,
    status:        row.status,
    notes:         row.notes,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  };
}

module.exports = router;
