'use strict';

require('dotenv').config();

// Refuse to start if JWT_SECRET is missing or is the example placeholder
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'change_this_to_a_long_random_string_before_going_live') {
  console.error('\n[FATAL] JWT_SECRET is not set or is still the default placeholder.');
  console.error('        Set a strong random value in your .env file before starting the server.\n');
  process.exit(1);
}

const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const app = express();

// ── CORS ───────────────────────────────────────────────────────────────────────
// Localhost is only allowed when explicitly running in development mode
const isDev = process.env.NODE_ENV === 'development';
const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(isDev ? ['http://localhost:3737', 'http://127.0.0.1:3737'] : []),
].filter(Boolean);

if (!process.env.FRONTEND_URL) {
  console.warn('[WARN] FRONTEND_URL is not set — CORS will block all browser requests.');
}

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ── Body parsing ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── CSRF guard ─────────────────────────────────────────────────────────────────
// State-changing requests must declare application/json. Browser forms cannot
// set this content-type cross-origin without a CORS preflight (already blocked),
// so this prevents form-based CSRF attacks on every POST/PUT/PATCH/DELETE route.
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const ct = req.headers['content-type'] || '';
    if (!ct.includes('application/json')) {
      return res.status(415).json({ error: 'Content-Type must be application/json.' });
    }
  }
  next();
});

// ── Global rate limit ──────────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
}));

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/checkout', require('./routes/checkout')); // public — no auth

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
