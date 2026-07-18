'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const app = express();

// ── CORS ───────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3737',
  'http://localhost:3737',
  'http://127.0.0.1:3737',
];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ── Trust proxy (Render / Heroku terminate TLS before Node) ───────────────────
app.set('trust proxy', 1);

// ── Body parsing ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Serve uploaded product images ──────────────────────────────────────────────
// UPLOAD_DIR lets Render's persistent disk (mounted outside the ephemeral
// container filesystem) hold uploads so they survive redeploys — see
// routes/upload.js and render.yaml.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
app.use('/uploads', express.static(UPLOAD_DIR));

// ── Global rate limit ──────────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
}));

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/products',  require('./routes/products'));
app.use('/api/addons',    require('./routes/addons'));
app.use('/api/orders',    require('./routes/orders'));
app.use('/api/messages',  require('./routes/messages'));
app.use('/api/checkout',  require('./routes/checkout'));
app.use('/api/upload',    require('./routes/upload'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/feed',      require('./routes/feed'));

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 handler ────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ── Error handler ──────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎂  Krispie's backend running on http://localhost:${PORT}`);
  console.log(`    Health: http://localhost:${PORT}/api/health\n`);
});
