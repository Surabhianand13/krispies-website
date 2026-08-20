'use strict';

const express = require('express');
const db = require('../db/database');

const router = express.Router();

// Returns { [productSlug]: { avg, count } } for every product that has
// at least one review — used both here and by products.js to attach
// rating badges to product cards without a second round-trip.
function getRatingsMap() {
  const rows = db.prepare(`
    SELECT product_slug, COUNT(*) AS count, AVG(rating) AS avg
    FROM reviews
    GROUP BY product_slug
  `).all();
  const map = {};
  for (const r of rows) {
    map[r.product_slug] = { avg: Math.round(r.avg * 10) / 10, count: r.count };
  }
  return map;
}

// GET /api/reviews/:slug — public. Aggregate + individual ratings for one product.
router.get('/:slug', (req, res) => {
  const rows = db.prepare(`
    SELECT customer_name, area, geography, rating, review_date
    FROM reviews
    WHERE product_slug = ?
    ORDER BY review_date DESC
  `).all(req.params.slug);

  if (!rows.length) return res.json({ avgRating: null, count: 0, reviews: [] });

  const avg = rows.reduce((sum, r) => sum + r.rating, 0) / rows.length;
  res.json({
    avgRating: Math.round(avg * 10) / 10,
    count: rows.length,
    reviews: rows.map(r => ({
      name: r.customer_name,
      area: r.area,
      geography: r.geography,
      rating: r.rating,
      date: r.review_date,
    })),
  });
});

module.exports = router;
module.exports.getRatingsMap = getRatingsMap;
