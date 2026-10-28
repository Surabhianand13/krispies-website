'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function uid() {
  return 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function toBanner(row) {
  return {
    id:           row.id,
    title:        row.title || '',
    link:         row.link || '',
    desktopImage: row.desktop_image || '',
    mobileImage:  row.mobile_image || '',
    altText:      row.alt_text || '',
    sortOrder:    row.sort_order || 0,
    active:       row.active === 1,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
  };
}

// GET /api/banners — public (active only); ?all=1 needs JWT
router.get('/', (req, res, next) => {
  if (req.query.all === '1') {
    return requireAuth(req, res, () => {
      const rows = db.prepare('SELECT * FROM banners ORDER BY sort_order ASC, created_at DESC').all();
      res.json(rows.map(toBanner));
    });
  }
  const rows = db.prepare('SELECT * FROM banners WHERE active = 1 ORDER BY sort_order ASC, created_at DESC').all();
  res.json(rows.map(toBanner));
});

// GET /api/banners/:id — JWT
router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Banner not found.' });
  res.json(toBanner(row));
});

const validators = () => [
  body('title').optional().trim(),
  body('link').optional().trim(),
  body('desktopImage').trim().notEmpty().withMessage('Desktop image is required.'),
  body('mobileImage').optional().trim(),
  body('altText').optional().trim(),
  body('sortOrder').optional().isInt(),
  body('active').optional().isBoolean(),
];

// POST /api/banners
router.post('/', requireAuth, validators(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const id = uid();
  const b = buildBanner(id, req.body);
  db.prepare(`
    INSERT INTO banners (id, title, link, desktop_image, mobile_image, alt_text, sort_order, active)
    VALUES (@id, @title, @link, @desktop_image, @mobile_image, @alt_text, @sort_order, @active)
  `).run(b);
  res.status(201).json(toBanner(db.prepare('SELECT * FROM banners WHERE id = ?').get(id)));
});

// PUT /api/banners/:id
router.put('/:id', requireAuth, validators(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const existing = db.prepare('SELECT id FROM banners WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Banner not found.' });

  const b = buildBanner(req.params.id, req.body);
  db.prepare(`
    UPDATE banners SET title=@title, link=@link, desktop_image=@desktop_image,
      mobile_image=@mobile_image, alt_text=@alt_text, sort_order=@sort_order,
      active=@active, updated_at=datetime('now')
    WHERE id=@id
  `).run(b);
  res.json(toBanner(db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id)));
});

// PATCH /api/banners/:id/toggle-active
router.patch('/:id/toggle-active', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Banner not found.' });
  db.prepare(`UPDATE banners SET active=@a, updated_at=datetime('now') WHERE id=@id`)
    .run({ a: row.active ? 0 : 1, id: req.params.id });
  res.json(toBanner(db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id)));
});

// PATCH /api/banners/reorder — bulk update sort_order
router.patch('/reorder', requireAuth, (req, res) => {
  const { order } = req.body; // array of { id, sortOrder }
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array.' });
  const update = db.prepare(`UPDATE banners SET sort_order=@s, updated_at=datetime('now') WHERE id=@id`);
  db.transaction(() => {
    for (const item of order) {
      if (item.id && typeof item.sortOrder === 'number') {
        update.run({ s: item.sortOrder, id: item.id });
      }
    }
  })();
  res.json({ updated: order.length });
});

// DELETE /api/banners/:id
router.delete('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT id FROM banners WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Banner not found.' });
  db.prepare('DELETE FROM banners WHERE id = ?').run(req.params.id);
  res.json({ message: 'Banner deleted.' });
});

function buildBanner(id, body) {
  return {
    id,
    title:         String(body.title || '').trim(),
    link:          String(body.link || '').trim(),
    desktop_image: String(body.desktopImage || '').trim(),
    mobile_image:  String(body.mobileImage || '').trim(),
    alt_text:      String(body.altText || '').trim(),
    sort_order:    parseInt(body.sortOrder, 10) || 0,
    active:        body.active !== false && body.active !== 0 ? 1 : 0,
  };
}

module.exports = router;
