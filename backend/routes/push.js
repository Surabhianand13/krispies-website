'use strict';

const express      = require('express');
const { requireAuth } = require('../middleware/auth');
const db           = require('../db/database');

const router = express.Router();

/* GET /api/push/vapid-public-key — no auth needed (public key is safe to expose) */
router.get('/vapid-public-key', (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: 'Push notifications not configured.' });
  res.json({ publicKey: key });
});

/* POST /api/push/subscribe — admin JWT required */
router.post('/subscribe', requireAuth, (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.auth || !keys?.p256dh) {
    return res.status(400).json({ error: 'Invalid subscription data.' });
  }
  db.prepare(`
    INSERT INTO push_subscriptions (endpoint, auth, p256dh)
    VALUES (?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET auth = excluded.auth, p256dh = excluded.p256dh
  `).run(endpoint, keys.auth, keys.p256dh);
  res.json({ ok: true });
});

/* DELETE /api/push/subscribe — admin JWT required */
router.delete('/subscribe', requireAuth, (req, res) => {
  const { endpoint } = req.body || {};
  if (endpoint) db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  res.json({ ok: true });
});

module.exports = router;
