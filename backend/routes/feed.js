'use strict';

/**
 * PUBLIC — Google Merchant Center product feed.
 * GET /api/feed/google-merchant.xml
 *
 * Google Shopping RSS 2.0 feed spec: https://support.google.com/merchants/answer/7052112
 */

const express = require('express');
const db      = require('../db/database');

const router = express.Router();

const SITE_URL = 'https://www.krispies.in';
const BRAND    = "Krispie's";

// Google product taxonomy IDs — https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt
const GOOGLE_CATEGORY = {
  'birthday-cakes':       2194, // Food, Beverages & Tobacco > Food Items > Bakery > Cakes & Dessert Bars
  'wedding-cakes':        2194,
  'engagement-cakes':     2194,
  'birthday-theme-cakes': 2194,
  'baby-shower-cakes':    2194,
  'customized-cakes':     2194,
  'cheesecakes':          2194,
  'donuts':               5751, // Food, Beverages & Tobacco > Food Items > Bakery > Donuts
  'biscuits':             2229, // Food, Beverages & Tobacco > Food Items > Bakery > Cookies
};
const DEFAULT_CATEGORY = 1876; // Food, Beverages & Tobacco > Food Items > Bakery

function escXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function cdata(s) {
  return `<![CDATA[${String(s == null ? '' : s).replace(/]]>/g, ']]&gt;')}]]>`;
}

function priceFromRow(row) {
  let variantGroups = [];
  try { variantGroups = JSON.parse(row.variant_groups || '[]'); } catch (_) {}
  const mrp = row.mrp || 0;
  const disc = row.discount || 0;
  const basePrice = disc > 0 ? Math.round(mrp * (1 - disc / 100)) : mrp;
  if (!variantGroups.length) return basePrice;
  const mins = variantGroups.map(g => {
    const prices = (g.options || []).map(o => o.price != null ? o.price : (o.priceDelta || 0));
    return g.optional ? 0 : Math.min(...prices);
  });
  return mins.reduce((a, b) => a + b, 0);
}

router.get('/google-merchant.xml', (_req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();

  const items = rows.map(row => {
    let images = [];
    try { images = JSON.parse(row.images || '[]'); } catch (_) {}
    if (!images.length) return ''; // Merchant Center requires an image

    const price = priceFromRow(row);
    if (!price) return ''; // Merchant Center requires a positive price

    const link = `${SITE_URL}/products/${encodeURIComponent(row.slug)}`;
    const imageLink = `${SITE_URL}/${images[0]}`;
    const extraImages = images.slice(1, 11)
      .map(img => `    <g:additional_image_link>${escXml(SITE_URL + '/' + img)}</g:additional_image_link>`)
      .join('\n');
    const category = GOOGLE_CATEGORY[row.category] || DEFAULT_CATEGORY;
    const availability = row.active === 1 ? 'in stock' : 'out of stock';

    return `  <item>
    <g:id>${escXml(row.slug)}</g:id>
    <title>${cdata(row.name)}</title>
    <description>${cdata(row.description)}</description>
    <link>${escXml(link)}</link>
    <g:image_link>${escXml(imageLink)}</g:image_link>
${extraImages}
    <g:availability>${availability}</g:availability>
    <g:price>${price.toFixed(2)} INR</g:price>
    <g:brand>${escXml(BRAND)}</g:brand>
    <g:condition>new</g:condition>
    <g:identifier_exists>no</g:identifier_exists>
    <g:google_product_category>${category}</g:google_product_category>
    <g:product_type>${escXml(row.category)}</g:product_type>
  </item>`;
  }).filter(Boolean).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
  <title>${escXml(BRAND)} — Product Feed</title>
  <link>${SITE_URL}</link>
  <description>${escXml(BRAND)} product catalog for Google Merchant Center</description>
${items}
</channel>
</rss>`;

  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
});

module.exports = router;
