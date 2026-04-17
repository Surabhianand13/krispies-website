'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { newMessageEmail } = require('../utils/email');

const router = express.Router();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Rate-limit public form submissions to 5 per hour per IP
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/messages — public (contact form)
router.post('/',
  submitLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email.'),
    body('phone').optional({ checkFalsy: true }).trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const m = {
      id:         uid(),
      name:       req.body.name.trim(),
      phone:      (req.body.phone || '').trim() || null,
      email:      (req.body.email || '').trim() || null,
      event_type: req.body.eventType || null,
      outlet:     req.body.outlet || null,
      quantity:   (req.body.quantity || '').trim() || null,
      event_date: req.body.eventDate || null,
      products:   (req.body.products || '').trim() || null,
      message:    (req.body.message || '').trim() || null,
      status:     'unread',
    };

    db.prepare(`
      INSERT INTO messages
        (id, name, phone, email, event_type, outlet, quantity, event_date, products, message, status)
      VALUES
        (@id, @name, @phone, @email, @event_type, @outlet, @quantity, @event_date, @products, @message, @status)
    `).run(m);

    // Fire-and-forget email notification
    newMessageEmail(m).catch(() => {});

    res.status(201).json({ message: 'Enquiry received. We\'ll be in touch soon!' });
  }
);

// ── All routes below require admin auth ────────────────────────────────────────

// GET /api/messages
router.get('/', requireAuth, (req, res) => {
  const { status, event, search } = req.query;
  let sql    = 'SELECT * FROM messages WHERE 1=1';
  const params = [];

  if (status) { sql += ' AND status = ?';      params.push(status); }
  if (event)  { sql += ' AND event_type = ?';  params.push(event); }
  if (search) {
    sql += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params).map(toMessage));
});

// GET /api/messages/:id
router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Message not found.' });
  res.json(toMessage(row));
});

// PATCH /api/messages/:id  — update status
router.patch('/:id', requireAuth,
  [body('status').notEmpty().withMessage('Status is required.')],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const existing = db.prepare('SELECT id FROM messages WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Message not found.' });

    db.prepare('UPDATE messages SET status = ? WHERE id = ?').run(req.body.status, req.params.id);
    res.json(toMessage(db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id)));
  }
);

// DELETE /api/messages/:id
router.delete('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT id FROM messages WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Message not found.' });
  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
  res.json({ message: 'Message deleted.' });
});

// ── Helper ─────────────────────────────────────────────────────────────────────
function toMessage(row) {
  return {
    id:          row.id,
    name:        row.name,
    phone:       row.phone,
    email:       row.email,
    eventType:   row.event_type,
    outlet:      row.outlet,
    quantity:    row.quantity,
    eventDate:   row.event_date,
    products:    row.products,
    message:     row.message,
    status:      row.status,
    submittedAt: row.created_at,
  };
}

module.exports = router;
