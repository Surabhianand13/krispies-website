'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const VALID_CATEGORIES = ['birthday-cakes', 'customized-cakes', 'wedding-cakes', 'engagement-cakes', 'cheesecakes', 'donuts'];
const VALID_TAGS       = ['bestseller', 'new', 'seasonal', 'custom'];

// GET /api/products — public, returns only active products
// GET /api/products?all=1 — protected, returns all (including inactive)
router.get('/', (req, res) => {
  const isAdmin = req.headers['authorization'];
  let rows;
  if (isAdmin && req.query.all === '1') {
    rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  } else {
    rows = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC').all();
  }
  res.json(rows.map(toProduct));
});

// GET /api/products/:id — public
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Product not found.' });
  res.json(toProduct(row));
});

// POST /api/products — protected
router.post('/',
  requireAuth,
  productValidators(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const p = {
      id:          uid(),
      name:        req.body.name.trim(),
      category:    req.body.category,
      tag:         req.body.tag || null,
      description: req.body.description.trim(),
      featured:    req.body.featured ? 1 : 0,
      active:      req.body.active !== false ? 1 : 0,
      mrp:         Number(req.body.mrp) || 0,
      discount:    Number(req.body.discount) || 0,
      images:      JSON.stringify(Array.isArray(req.body.images) ? req.body.images : []),
    };

    db.prepare(`
      INSERT INTO products (id, name, category, tag, description, featured, active, mrp, discount, images)
      VALUES (@id, @name, @category, @tag, @description, @featured, @active, @mrp, @discount, @images)
    `).run(p);

    res.status(201).json(toProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(p.id)));
  }
);

// PUT /api/products/:id — protected
router.put('/:id',
  requireAuth,
  productValidators(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found.' });

    db.prepare(`
      UPDATE products
      SET name = @name, category = @category, tag = @tag, description = @description,
          featured = @featured, active = @active,
          mrp = @mrp, discount = @discount, images = @images,
          updated_at = datetime('now')
      WHERE id = @id
    `).run({
      id:          req.params.id,
      name:        req.body.name.trim(),
      category:    req.body.category,
      tag:         req.body.tag || null,
      description: req.body.description.trim(),
      featured:    req.body.featured ? 1 : 0,
      active:      req.body.active !== false ? 1 : 0,
      mrp:         Number(req.body.mrp) || 0,
      discount:    Number(req.body.discount) || 0,
      images:      JSON.stringify(Array.isArray(req.body.images) ? req.body.images : []),
    });

    res.json(toProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)));
  }
);

// DELETE /api/products/:id — protected
router.delete('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ message: 'Product deleted.' });
});

// ── Helpers ────────────────────────────────────────────────────────────────────
function toProduct(row) {
  let images = [];
  try { images = JSON.parse(row.images || '[]'); } catch {}
  return {
    id:          row.id,
    name:        row.name,
    category:    row.category,
    tag:         row.tag,
    description: row.description,
    mrp:         row.mrp || 0,
    discount:    row.discount || 0,
    images,
    featured:    row.featured === 1,
    active:      row.active === 1,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

function productValidators() {
  return [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('category').isIn(VALID_CATEGORIES).withMessage('Invalid category.'),
    body('tag').optional({ nullable: true }).isIn([...VALID_TAGS, null, '']).withMessage('Invalid tag.'),
    body('description').trim().notEmpty().withMessage('Description is required.'),
  ];
}

module.exports = router;
