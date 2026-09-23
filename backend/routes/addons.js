'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function toAddon(row) {
  let categories = [];
  try { categories = JSON.parse(row.categories || '[]'); } catch (_) {}
  return {
    id:         row.id,
    name:       row.name,
    price:      row.price,
    unit:       row.unit,
    image:      row.image || '',
    categories, // empty array = shows for every product category
    active:     row.active === 1,
    createdAt:  row.created_at,
    updatedAt:  row.updated_at,
  };
}

function buildAddon(id, body) {
  let categories = [];
  try { categories = JSON.parse(body.categories || '[]'); } catch (_) { categories = []; }
  if (!Array.isArray(categories)) categories = [];
  return {
    id,
    name:       String(body.name || '').trim(),
    price:      parseFloat(body.price) || 0,
    unit:       String(body.unit || 'each').trim(),
    image:      String(body.image || '').trim(),
    categories: JSON.stringify(categories.filter(Boolean)),
    active:     body.active !== false && body.active !== 0 ? 1 : 0,
  };
}

function addonValidators() {
  return [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  ];
}

// GET /api/addons — public active only; ?all=1 needs JWT (admin list)
router.get('/', (req, res, next) => {
  if (req.query.all === '1') {
    return requireAuth(req, res, () => {
      const rows = db.prepare('SELECT * FROM addons ORDER BY created_at DESC').all();
      res.json(rows.map(toAddon));
    });
  }
  const rows = db.prepare('SELECT * FROM addons WHERE active = 1 ORDER BY created_at DESC').all();
  res.json(rows.map(toAddon));
});

// POST /api/addons
router.post('/', requireAuth, addonValidators(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const id = uid();
  const a = buildAddon(id, req.body);
  db.prepare(`
    INSERT INTO addons (id, name, price, unit, image, categories, active)
    VALUES (@id, @name, @price, @unit, @image, @categories, @active)
  `).run(a);

  res.status(201).json(toAddon(db.prepare('SELECT * FROM addons WHERE id = ?').get(a.id)));
});

// PUT /api/addons/:id
router.put('/:id', requireAuth, addonValidators(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const existing = db.prepare('SELECT id FROM addons WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Add-on not found.' });

  const a = buildAddon(req.params.id, req.body);
  db.prepare(`
    UPDATE addons
    SET name=@name, price=@price, unit=@unit, image=@image,
        categories=@categories, active=@active, updated_at=datetime('now')
    WHERE id=@id
  `).run(a);

  res.json(toAddon(db.prepare('SELECT * FROM addons WHERE id = ?').get(req.params.id)));
});

// DELETE /api/addons/:id
router.delete('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT id FROM addons WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Add-on not found.' });
  db.prepare('DELETE FROM addons WHERE id = ?').run(req.params.id);
  res.json({ message: 'Add-on deleted.' });
});

module.exports = router;
