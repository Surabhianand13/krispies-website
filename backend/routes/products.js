'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const VALID_CATEGORIES = [
  'birthday-cakes', 'customized-cakes', 'wedding-cakes',
  'engagement-cakes', 'baby-shower-cakes', 'cheesecakes', 'donuts', 'biscuits',
];
const VALID_TAGS = ['bestseller', 'new', 'seasonal', 'custom'];

// GET /api/products — public active only; ?all=1 needs JWT
router.get('/', (req, res, next) => {
  if (req.query.all === '1') {
    return requireAuth(req, res, () => {
      const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
      res.json(rows.map(toProduct));
    });
  }
  const rows = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC').all();
  res.json(rows.map(toProduct));
});

// GET /api/products/featured — public
router.get('/featured', (_req, res) => {
  const rows = db.prepare('SELECT * FROM products WHERE active = 1 AND featured = 1 ORDER BY updated_at DESC').all();
  res.json(rows.map(toProduct));
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Product not found.' });
  res.json(toProduct(row));
});

// POST /api/products
router.post('/', requireAuth, productValidators(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const p = buildProduct(uid(), req.body);
  db.prepare(`
    INSERT INTO products (id, name, category, tag, description, mrp, discount, images, featured, active)
    VALUES (@id, @name, @category, @tag, @description, @mrp, @discount, @images, @featured, @active)
  `).run(p);

  res.status(201).json(toProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(p.id)));
});

// PUT /api/products/:id
router.put('/:id', requireAuth, productValidators(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });

  const p = buildProduct(req.params.id, req.body);
  db.prepare(`
    UPDATE products
    SET name=@name, category=@category, tag=@tag, description=@description,
        mrp=@mrp, discount=@discount, images=@images,
        featured=@featured, active=@active, updated_at=datetime('now')
    WHERE id=@id
  `).run(p);

  res.json(toProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)));
});

// PATCH /api/products/:id/toggle-active
router.patch('/:id/toggle-active', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Product not found.' });
  db.prepare(`UPDATE products SET active=@a, updated_at=datetime('now') WHERE id=@id`)
    .run({ a: row.active ? 0 : 1, id: req.params.id });
  res.json(toProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)));
});

// PATCH /api/products/:id/toggle-featured
router.patch('/:id/toggle-featured', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Product not found.' });
  db.prepare(`UPDATE products SET featured=@f, updated_at=datetime('now') WHERE id=@id`)
    .run({ f: row.featured ? 0 : 1, id: req.params.id });
  res.json(toProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)));
});

// DELETE /api/products/:id
router.delete('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ message: 'Product deleted.' });
});

// ── Helpers ────────────────────────────────────────────────────────────────────
function buildProduct(id, body) {
  let images = [];
  try { images = JSON.parse(body.images || '[]'); } catch (_) { images = []; }
  if (!Array.isArray(images)) images = [];
  return {
    id,
    name:        String(body.name || '').trim(),
    category:    body.category,
    tag:         body.tag || null,
    description: String(body.description || '').trim(),
    mrp:         parseFloat(body.mrp) || 0,
    discount:    parseFloat(body.discount) || 0,
    images:      JSON.stringify(images),
    featured:    body.featured ? 1 : 0,
    active:      body.active !== false && body.active !== 0 ? 1 : 0,
  };
}

function toProduct(row) {
  let images = [];
  try { images = JSON.parse(row.images || '[]'); } catch (_) {}
  const mrp = row.mrp || 0;
  const disc = row.discount || 0;
  return {
    id:          row.id,
    name:        row.name,
    category:    row.category,
    tag:         row.tag,
    description: row.description,
    mrp,
    discount:    disc,
    price:       disc > 0 ? Math.round(mrp * (1 - disc / 100)) : mrp,
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
    body('mrp').optional().isFloat({ min: 0 }).withMessage('MRP must be a positive number.'),
    body('discount').optional().isFloat({ min: 0, max: 100 }).withMessage('Discount must be 0-100.'),
  ];
}

module.exports = router;
