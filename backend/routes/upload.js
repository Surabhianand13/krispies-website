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

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 7) + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only jpg, png, webp, or gif images are allowed.'));
  },
});

router.post('/', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  // Build the public URL using forwarded headers (Render terminates TLS before Node)
  const proto   = (req.headers['x-forwarded-proto'] || req.protocol).split(',')[0].trim();
  const baseUrl = `${proto}://${req.get('host')}`;
  res.json({ url: `${baseUrl}/uploads/${req.file.filename}` });
});

// Multer error handler (e.g. file too large, wrong type)
router.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || 'Upload failed.' });
});

module.exports = router;
