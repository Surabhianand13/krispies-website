'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const path       = require('path');
const { dbRateLimit } = require('./middleware/dbRateLimit');

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
// This service is a JSON API + static image host (product images uploaded via
// /api/upload) -- it doesn't render the storefront's HTML, so a strict CSP
// belongs at the Cloudflare Pages layer (_headers) instead of here. Helmet
// still gives us nosniff, no X-Powered-By, HSTS, frameguard, etc. by default.
// crossOriginResourcePolicy is relaxed to cross-origin because /uploads images
// are fetched from www.krispies.in, a different origin than this API.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

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
// DB-backed -- see middleware/dbRateLimit.js. express-rate-limit's in-memory
// store silently doesn't work once an app runs as more than one process,
// which this one does; confirmed live (12 requests to a "10 per 15 min"
// limiter never tripped it before this fix).
app.use(dbRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  keyGenerator: (req) => `global:${req.ip}`,
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
app.use('/api/reviews',   require('./routes/reviews'));

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
