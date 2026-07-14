'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Generates a unique slug, appending -2, -3, ... on collision.
// excludeId lets an update keep its own existing slug without colliding with itself.
function uniqueSlug(base, excludeId) {
  let slug = base || 'product';
  let n = 2;
  const taken = () => {
    const row = db.prepare('SELECT id FROM products WHERE slug = ?').get(slug);
    return row && row.id !== excludeId;
  };
  while (taken()) { slug = `${base}-${n}`; n++; }
  return slug;
}

const VALID_CATEGORIES = [
  'birthday-cakes', 'customized-cakes', 'wedding-cakes',
  'engagement-cakes', 'baby-shower-cakes', 'birthday-theme-cakes',
  'cheesecakes', 'donuts', 'biscuits',
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

// GET /api/products/slug/:slug — public, for the product detail page
router.get('/slug/:slug', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE slug = ?').get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Product not found.' });
  res.json(toProduct(row));
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

  const id = uid();
  const p = buildProduct(id, req.body);
  p.slug = uniqueSlug(slugify(req.body.slug || req.body.name), id);
  db.prepare(`
    INSERT INTO products (id, name, category, tag, flavour, description, mrp, discount, images, variant_groups, prep_hours, slug, featured, active)
    VALUES (@id, @name, @category, @tag, @flavour, @description, @mrp, @discount, @images, @variant_groups, @prep_hours, @slug, @featured, @active)
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
  p.slug = uniqueSlug(slugify(req.body.slug || req.body.name), req.params.id);
  db.prepare(`
    UPDATE products
    SET name=@name, category=@category, tag=@tag, flavour=@flavour, description=@description,
        mrp=@mrp, discount=@discount, images=@images,
        variant_groups=@variant_groups, prep_hours=@prep_hours, slug=@slug,
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

  let variantGroups = [];
  try { variantGroups = JSON.parse(body.variantGroups || '[]'); } catch (_) { variantGroups = []; }
  if (!Array.isArray(variantGroups)) variantGroups = [];
  // Sanitize: each group needs a name and a non-empty options array; each
  // option needs a label and a numeric price -- this is the option's own
  // final selling price (e.g. Half Kg = 699), not an add-on to mrp/discount.
  variantGroups = variantGroups
    .map(g => ({
      name: String(g?.name || '').trim(),
      optional: !!g?.optional,
      options: Array.isArray(g?.options)
        ? g.options
            .map(o => ({ label: String(o?.label || '').trim(), price: parseFloat(o?.price) || 0 }))
            .filter(o => o.label)
        : [],
    }))
    .filter(g => g.name && g.options.length > 0);

  return {
    id,
    name:           String(body.name || '').trim(),
    category:       body.category,
    tag:            body.tag || null,
    flavour:        String(body.flavour || '').trim() || null,
    description:    String(body.description || '').trim(),
    mrp:            parseFloat(body.mrp) || 0,
    discount:       parseFloat(body.discount) || 0,
    images:         JSON.stringify(images),
    variant_groups: JSON.stringify(variantGroups),
    prep_hours:     Math.max(0, parseInt(body.prepHours, 10) || 0),
    featured:       body.featured ? 1 : 0,
    active:         body.active !== false && body.active !== 0 ? 1 : 0,
  };
}

function toProduct(row) {
  let images = [];
  try { images = JSON.parse(row.images || '[]'); } catch (_) {}
  let variantGroups = [];
  try { variantGroups = JSON.parse(row.variant_groups || '[]'); } catch (_) {}
  // Normalize legacy rows saved before variant prices were absolute
  // (priceDelta instead of price) so old data still reads correctly.
  variantGroups = variantGroups.map(g => ({
    name: g.name,
    optional: !!g.optional,
    options: (g.options || []).map(o => ({ label: o.label, price: o.price != null ? o.price : (o.priceDelta || 0) })),
  }));

  const mrp = row.mrp || 0;
  const disc = row.discount || 0;
  const basePrice = disc > 0 ? Math.round(mrp * (1 - disc / 100)) : mrp;

  // When variants exist, each option's price IS the final price for that
  // choice (customer picks one option per group and pays the sum of their
  // selections) -- mrp/discount are ignored in favour of whatever the
  // admin set per option. An optional group can be skipped entirely, so
  // its cheapest possible contribution is 0, not its cheapest option.
  let priceFrom = basePrice, priceTo = basePrice;
  if (variantGroups.length) {
    const groupPriceRange = g => {
      const prices = g.options.map(o => o.price);
      return [g.optional ? 0 : Math.min(...prices), Math.max(...prices)];
    };
    const mins = variantGroups.map(g => groupPriceRange(g)[0]);
    const maxs = variantGroups.map(g => groupPriceRange(g)[1]);
    priceFrom = mins.reduce((a, b) => a + b, 0);
    priceTo   = maxs.reduce((a, b) => a + b, 0);
  }

  return {
    id:            row.id,
    name:          row.name,
    slug:          row.slug,
    category:      row.category,
    tag:           row.tag,
    flavour:       row.flavour || null,
    description:   row.description,
    mrp,
    discount:      disc,
    price:         variantGroups.length ? priceFrom : basePrice,
    priceFrom,
    priceTo,
    images,
    variantGroups,
    prepHours:     row.prep_hours || 0,
    featured:      row.featured === 1,
    active:        row.active === 1,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
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
    body('prepHours').optional().isInt({ min: 0 }).withMessage('Prep time must be a positive number of hours.'),
  ];
}

module.exports = router;
