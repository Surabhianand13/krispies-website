'use strict';

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

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

router.post('/', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  const ext = detectImageExt(req.file.buffer);
  if (!ext) {
    return res.status(400).json({ error: 'File content is not a recognized jpg, png, webp, or gif image.' });
  }

  const filename = Date.now() + '-' + Math.random().toString(36).slice(2, 7) + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);

  // Build the public URL using forwarded headers (Render terminates TLS before Node)
  const proto   = (req.headers['x-forwarded-proto'] || req.protocol).split(',')[0].trim();
  const baseUrl = `${proto}://${req.get('host')}`;
  res.json({ url: `${baseUrl}/uploads/${filename}` });
});

// Multer error handler (e.g. file too large, wrong type)
router.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || 'Upload failed.' });
});

module.exports = router;
