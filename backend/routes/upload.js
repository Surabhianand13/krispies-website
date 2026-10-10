'use strict';

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const sharp   = require('sharp');
const db      = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const router = express.Router();

// ── R2 (Cloudflare) — S3-compatible object storage, served via Cloudflare CDN ─
// When all four env vars are set, new uploads go straight to R2 and DB URLs
// point there; otherwise falls back to local disk (dev / unconfigured).
const R2_BUCKET     = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

let r2Client = null;
if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_PUBLIC_URL) {
  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

// UPLOAD_DIR lets Render's persistent disk hold uploads so they survive
// redeploys (see server.js and render.yaml) — falls back to a local folder
// for development.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Buffer the upload in memory rather than writing straight to disk. Both the
// client-sent mimetype and the original filename's extension are fully
// attacker-controlled -- trusting either one for the saved file's extension
// would let a JWT-holding admin session (or a stolen one, via some other
// hole) upload e.g. a .html file disguised as "image/jpeg" and have it
// served back as real HTML from our own origin. Instead we sniff the actual
// file bytes and derive the extension from that.
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

const MAGIC_SIGNATURES = [
  { ext: '.jpg',  test: buf => buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF },
  { ext: '.png',  test: buf => buf.length >= 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) },
  { ext: '.gif',  test: buf => buf.length >= 6 && ['GIF87a', 'GIF89a'].includes(buf.slice(0, 6).toString('ascii')) },
  { ext: '.webp', test: buf => buf.length >= 12 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP' },
];

function detectImageExt(buffer) {
  const match = MAGIC_SIGNATURES.find(sig => sig.test(buffer));
  return match ? match.ext : null;
}

// Every uploaded file goes through the same resize+recompress pipeline
// before it ever touches disk, regardless of what format it arrived in --
// product photos straight off a phone camera were showing up as 2-5MB PNGs
// (a lossless format, hugely inefficient for photographic content), and
// 100+ of those on one category page was the direct cause of "images not
// loading" and "page stuck loading" reports on slower connections/devices.
// 1600px on the long edge is comfortably more than this site ever displays
// a product photo at (including retina), and JPEG at quality 82 is visually
// indistinguishable from the source for a photograph while typically
// landing 10-20x smaller than the equivalent PNG.
async function optimizeImageBuffer(buffer) {
  return sharp(buffer)
    .rotate() // apply EXIF orientation before resizing, then the tag itself is dropped
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  const ext = detectImageExt(req.file.buffer);
  if (!ext) {
    return res.status(400).json({ error: 'File content is not a recognized jpg, png, webp, or gif image.' });
  }

  let outputBuffer;
  try {
    outputBuffer = await optimizeImageBuffer(req.file.buffer);
  } catch (err) {
    console.error('[upload] image processing failed:', err.message);
    return res.status(400).json({ error: 'Could not process this image. Try a different file.' });
  }

  // Every upload is re-encoded to JPEG above, so the saved file is always
  // .jpg regardless of what format was uploaded.
  const filename = Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.jpg';

  if (r2Client) {
    // Upload to R2: served from Cloudflare's CDN edge — faster than Render,
    // zero egress fees, and doesn't count against Render's bandwidth quota.
    try {
      await r2Client.send(new PutObjectCommand({
        Bucket:      R2_BUCKET,
        Key:         filename,
        Body:        outputBuffer,
        ContentType: 'image/jpeg',
      }));
      return res.json({ url: `${R2_PUBLIC_URL}/${filename}` });
    } catch (err) {
      // Fall through to local disk so admin uploads aren't blocked during
      // a temporary R2 outage or misconfiguration.
      console.error('[upload] R2 upload failed, falling back to local disk:', err.message);
    }
  }

  // Fallback: write to local disk (dev mode, or R2 not configured / temporarily down).
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), outputBuffer);
  const proto   = (req.headers['x-forwarded-proto'] || req.protocol).split(',')[0].trim();
  const baseUrl = `${proto}://${req.get('host')}`;
  res.json({ url: `${baseUrl}/uploads/${filename}` });
});

// Rewrites full URL matches in product/addon image fields -- used when migrating
// existing uploads from one host to another (e.g. Render disk → R2).
// Each key is a URL substring to match (e.g. "/uploads/file.jpg") and the
// value is the full replacement URL.
function rewriteUrlReferences(urlRewrites) {
  if (!Object.keys(urlRewrites).length) return;

  const products = db.prepare('SELECT id, images FROM products').all();
  const updateProduct = db.prepare('UPDATE products SET images = ? WHERE id = ?');
  for (const row of products) {
    let arr;
    try { arr = JSON.parse(row.images || '[]'); } catch (_) { arr = []; }
    if (!Array.isArray(arr) || !arr.length) continue;
    let changed = false;
    const next = arr.map(url => {
      if (typeof url !== 'string') return url;
      for (const [suffix, newUrl] of Object.entries(urlRewrites)) {
        if (url.includes(suffix)) { changed = true; return newUrl; }
      }
      return url;
    });
    if (changed) updateProduct.run(JSON.stringify(next), row.id);
  }

  const addons = db.prepare('SELECT id, image FROM addons').all();
  const updateAddon = db.prepare('UPDATE addons SET image = ? WHERE id = ?');
  for (const row of addons) {
    if (!row.image) continue;
    let next = row.image;
    let changed = false;
    for (const [suffix, newUrl] of Object.entries(urlRewrites)) {
      if (next.includes(suffix)) { changed = true; next = newUrl; break; }
    }
    if (changed) updateAddon.run(next, row.id);
  }
}

// Replaces a URL base prefix across all product/addon image fields in the DB.
// Used to fix bulk-migrated URLs that were written with the wrong base
// (e.g. the placeholder https://pub-xxxx.r2.dev instead of the real one).
// Body: { from: 'https://old-base', to: 'https://new-base' }
router.post('/repair-urls', requireAuth, (req, res) => {
  const { from, to } = req.body || {};
  if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
    return res.status(400).json({ error: 'Body must have { from, to } strings.' });
  }
  const fromBase = from.replace(/\/$/, '');
  const toBase   = to.replace(/\/$/, '');

  let fixed = 0;

  const products = db.prepare('SELECT id, images FROM products').all();
  const updateProduct = db.prepare('UPDATE products SET images = ? WHERE id = ?');
  for (const row of products) {
    let arr;
    try { arr = JSON.parse(row.images || '[]'); } catch (_) { arr = []; }
    if (!Array.isArray(arr) || !arr.length) continue;
    let changed = false;
    const next = arr.map(url => {
      if (typeof url === 'string' && url.startsWith(fromBase)) {
        changed = true;
        fixed++;
        return toBase + url.slice(fromBase.length);
      }
      return url;
    });
    if (changed) updateProduct.run(JSON.stringify(next), row.id);
  }

  const addons = db.prepare('SELECT id, image FROM addons').all();
  const updateAddon = db.prepare('UPDATE addons SET image = ? WHERE id = ?');
  for (const row of addons) {
    if (typeof row.image === 'string' && row.image.startsWith(fromBase)) {
      updateAddon.run(toBase + row.image.slice(fromBase.length), row.id);
      fixed++;
    }
  }

  res.json({ fixed, message: `Replaced ${fixed} URL(s) from "${fromBase}" → "${toBase}".` });
});

// Copies every file in UPLOAD_DIR to R2 and rewrites all DB image URLs to
// point to R2.  Safe to run multiple times -- uploading the same key to R2
// just overwrites it, and a URL already pointing to R2 won't match the
// /uploads/ suffix pattern so it won't be double-rewritten.
router.post('/migrate-to-r2', requireAuth, async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({
      error: 'R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL on the server.',
    });
  }

  let files;
  try {
    files = fs.readdirSync(UPLOAD_DIR).filter(f => /\.(jpe?g|png|gif|webp)$/i.test(f));
  } catch (_) {
    return res.status(500).json({ error: 'Could not read uploads directory.' });
  }

  let uploaded = 0, failed = 0, bytes = 0;
  const urlRewrites = {};

  for (const file of files) {
    let buf;
    try { buf = fs.readFileSync(path.join(UPLOAD_DIR, file)); } catch (_) { failed++; continue; }
    try {
      await r2Client.send(new PutObjectCommand({
        Bucket:      R2_BUCKET,
        Key:         file,
        Body:        buf,
        ContentType: 'image/jpeg',
      }));
      urlRewrites[`/uploads/${file}`] = `${R2_PUBLIC_URL}/${file}`;
      bytes += buf.length;
      uploaded++;
    } catch (err) {
      console.error('[migrate-to-r2] failed for', file, err.message);
      failed++;
    }
  }

  rewriteUrlReferences(urlRewrites);

  res.json({
    uploaded,
    failed,
    totalMB:  Math.round(bytes / 1024 / 1024 * 10) / 10,
    message: failed
      ? `${failed} file(s) failed — check server logs. ${uploaded} migrated successfully.`
      : `Migration complete — ${uploaded} image(s) now served from R2.`,
  });
});

// One-time (repeatable/idempotent) backfill for images uploaded before the
// pipeline above existed. Re-processes every file already in UPLOAD_DIR
// through the identical resize+recompress step and overwrites it in place.
// Files that changed extension (basically all of them, png -> jpg) are
// renamed on disk, and every products.images / addons.image reference to
// the old filename is rewritten to match -- otherwise every product photo
// on the site would silently 404 the moment this ran.
// Skips anything already under 300KB so re-running this later (e.g. after
// a partial run, or just to catch newly-uploaded outliers) never re-touches
// files the pipeline has already shrunk -- avoids repeated JPEG generation
// loss and keeps this safe to click more than once.
const ALREADY_SMALL_BYTES = 300 * 1024;

function rewriteImageReferences(renames) {
  if (!Object.keys(renames).length) return;

  const products = db.prepare('SELECT id, images FROM products').all();
  const updateProduct = db.prepare('UPDATE products SET images = ? WHERE id = ?');
  for (const row of products) {
    let arr;
    try { arr = JSON.parse(row.images || '[]'); } catch (_) { arr = []; }
    if (!Array.isArray(arr) || !arr.length) continue;
    let changed = false;
    const next = arr.map(url => {
      for (const [oldName, newName] of Object.entries(renames)) {
        if (typeof url === 'string' && url.includes('/uploads/' + oldName)) {
          changed = true;
          return url.replace(oldName, newName);
        }
      }
      return url;
    });
    if (changed) updateProduct.run(JSON.stringify(next), row.id);
  }

  const addons = db.prepare('SELECT id, image FROM addons').all();
  const updateAddon = db.prepare('UPDATE addons SET image = ? WHERE id = ?');
  for (const row of addons) {
    if (!row.image) continue;
    let next = row.image;
    let changed = false;
    for (const [oldName, newName] of Object.entries(renames)) {
      if (next.includes('/uploads/' + oldName)) { changed = true; next = next.replace(oldName, newName); }
    }
    if (changed) updateAddon.run(next, row.id);
  }
}

router.post('/optimize-existing', requireAuth, async (req, res) => {
  let files;
  try {
    files = fs.readdirSync(UPLOAD_DIR).filter(f => /\.(png|jpe?g|gif|webp)$/i.test(f));
  } catch (err) {
    return res.status(500).json({ error: 'Could not read the uploads directory.' });
  }

  let processed = 0, skipped = 0, failed = 0, bytesBefore = 0, bytesAfter = 0;
  const renames = {};

  for (const file of files) {
    const oldPath = path.join(UPLOAD_DIR, file);
    let stat;
    try { stat = fs.statSync(oldPath); } catch (_) { failed++; continue; }

    if (stat.size < ALREADY_SMALL_BYTES) { skipped++; continue; }

    try {
      const inputBuffer = fs.readFileSync(oldPath);
      const outputBuffer = await optimizeImageBuffer(inputBuffer);

      const ext = path.extname(file);
      const newFile = ext.toLowerCase() === '.jpg' ? file : file.slice(0, -ext.length) + '.jpg';
      const newPath = path.join(UPLOAD_DIR, newFile);

      fs.writeFileSync(newPath, outputBuffer);
      if (newFile !== file) {
        fs.unlinkSync(oldPath);
        renames[file] = newFile;
      }

      bytesBefore += stat.size;
      bytesAfter += outputBuffer.length;
      processed++;
    } catch (err) {
      console.error('[upload] optimize-existing failed for', file, err.message);
      failed++;
    }
  }

  rewriteImageReferences(renames);

  res.json({
    processed,
    skipped,
    failed,
    bytesBeforeMB: Math.round(bytesBefore / 1024 / 1024 * 10) / 10,
    bytesAfterMB: Math.round(bytesAfter / 1024 / 1024 * 10) / 10,
    savedMB: Math.round((bytesBefore - bytesAfter) / 1024 / 1024 * 10) / 10,
  });
});

// Multer error handler (e.g. file too large, wrong type)
router.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || 'Upload failed.' });
});

module.exports = router;
