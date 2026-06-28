'use strict';

const express  = require('express');
const db       = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/analytics/track — public, lightweight page view tracking
router.post('/track', (req, res) => {
  try {
    const { session_id, path, referrer, device_type } = req.body || {};
    if (!path) return res.status(400).json({ error: 'path required' });

    // Detect device from user-agent if not provided
    const ua = req.headers['user-agent'] || '';
    const device = device_type || (/mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop');

    db.prepare(`
      INSERT INTO page_views (session_id, path, referrer, device_type, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(session_id || null, path.slice(0, 255), (referrer || '').slice(0, 255), device);

    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});

// POST /api/analytics/event — public, track custom events
router.post('/event', (req, res) => {
  try {
    const { session_id, type, label, path, meta } = req.body || {};
    if (!type) return res.status(400).json({ error: 'type required' });

    db.prepare(`
      INSERT INTO events (session_id, type, label, path, meta, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(
      session_id || null, type.slice(0, 64),
      (label || '').slice(0, 255),
      (path || '').slice(0, 255),
      meta ? JSON.stringify(meta).slice(0, 500) : null
    );

    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});

// GET /api/analytics/summary — protected
router.get('/summary', requireAuth, (req, res) => {
  const now = new Date();

  function dateStr(daysAgo, startOfDay = true) {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    if (startOfDay) d.setHours(0, 0, 0, 0);
    return d.toISOString().replace('T', ' ').slice(0, 19);
  }

  const ranges = {
    today:     dateStr(0),
    yesterday: dateStr(1),
    days3:     dateStr(3),
    days7:     dateStr(7),
    days30:    dateStr(30),
  };

  function viewsInRange(from, to) {
    if (to) {
      return db.prepare(`SELECT COUNT(*) as c FROM page_views WHERE created_at >= ? AND created_at < ?`).get(from, to).c;
    }
    return db.prepare(`SELECT COUNT(*) as c FROM page_views WHERE created_at >= ?`).get(from).c;
  }

  function uniqueInRange(from, to) {
    if (to) {
      return db.prepare(`SELECT COUNT(DISTINCT session_id) as c FROM page_views WHERE created_at >= ? AND created_at < ? AND session_id IS NOT NULL`).get(from, to).c;
    }
    return db.prepare(`SELECT COUNT(DISTINCT session_id) as c FROM page_views WHERE created_at >= ? AND session_id IS NOT NULL`).get(from).c;
  }

  // Top pages last 7 days
  const topPages = db.prepare(`
    SELECT path, COUNT(*) as views
    FROM page_views WHERE created_at >= ?
    GROUP BY path ORDER BY views DESC LIMIT 10
  `).all(ranges.days7);

  // Device split last 7 days
  const deviceSplit = db.prepare(`
    SELECT device_type, COUNT(*) as c
    FROM page_views WHERE created_at >= ?
    GROUP BY device_type
  `).all(ranges.days7);

  // Hourly distribution last 7 days
  const hourly = db.prepare(`
    SELECT strftime('%H', created_at) as hour, COUNT(*) as views
    FROM page_views WHERE created_at >= ?
    GROUP BY hour ORDER BY hour
  `).all(ranges.days7);

  // Daily trend last 30 days
  const dailyTrend = db.prepare(`
    SELECT strftime('%Y-%m-%d', created_at) as date, COUNT(*) as views,
           COUNT(DISTINCT session_id) as visitors
    FROM page_views WHERE created_at >= ?
    GROUP BY date ORDER BY date
  `).all(ranges.days30);

  // Event counts last 7 days
  const eventCounts = db.prepare(`
    SELECT type, COUNT(*) as c FROM events WHERE created_at >= ?
    GROUP BY type ORDER BY c DESC
  `).all(ranges.days7);

  // Revenue summary from orders
  const revenueToday = db.prepare(`
    SELECT COALESCE(SUM(amount),0) as total FROM orders
    WHERE status='delivered' AND created_at >= ?
  `).get(ranges.today).total;

  const revenueWeek = db.prepare(`
    SELECT COALESCE(SUM(amount),0) as total FROM orders
    WHERE status='delivered' AND created_at >= ?
  `).get(ranges.days7).total;

  const revenueMonth = db.prepare(`
    SELECT COALESCE(SUM(amount),0) as total FROM orders
    WHERE status='delivered' AND created_at >= ?
  `).get(ranges.days30).total;

  // Orders summary
  const orderSummary = db.prepare(`
    SELECT status, COUNT(*) as c FROM orders GROUP BY status
  `).all();

  const ordersToday = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE created_at >= ?`).get(ranges.today).c;

  // Enquiries summary
  const enquiriesUnread = db.prepare(`SELECT COUNT(*) as c FROM messages WHERE status='unread'`).get().c;
  const enquiriesToday  = db.prepare(`SELECT COUNT(*) as c FROM messages WHERE created_at >= ?`).get(ranges.today).c;

  // Daily revenue last 30 days
  const dailyRevenue = db.prepare(`
    SELECT strftime('%Y-%m-%d', created_at) as date, COALESCE(SUM(amount),0) as revenue, COUNT(*) as orders
    FROM orders WHERE status='delivered' AND created_at >= ?
    GROUP BY date ORDER BY date
  `).all(ranges.days30);

  res.json({
    traffic: {
      today:         { views: viewsInRange(ranges.today), visitors: uniqueInRange(ranges.today) },
      yesterday:     { views: viewsInRange(ranges.yesterday, ranges.today), visitors: uniqueInRange(ranges.yesterday, ranges.today) },
      days3:         { views: viewsInRange(ranges.days3), visitors: uniqueInRange(ranges.days3) },
      days7:         { views: viewsInRange(ranges.days7), visitors: uniqueInRange(ranges.days7) },
      days30:        { views: viewsInRange(ranges.days30), visitors: uniqueInRange(ranges.days30) },
    },
    topPages,
    deviceSplit,
    hourly,
    dailyTrend,
    eventCounts,
    revenue: { today: revenueToday, week: revenueWeek, month: revenueMonth },
    orders:  { summary: orderSummary, today: ordersToday },
    enquiries: { unread: enquiriesUnread, today: enquiriesToday },
    dailyRevenue,
  });
});

// GET /api/analytics/live — quick live counters for polling
router.get('/live', requireAuth, (req, res) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const pendingOrders   = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status='pending'`).get().c;
  const unreadEnquiries = db.prepare(`SELECT COUNT(*) as c FROM messages WHERE status='unread'`).get().c;
  const todayOrders     = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE created_at >= ?`).get(todayStr + ' 00:00:00').c;
  const todayRevenue    = db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM orders WHERE status='delivered' AND created_at >= ?`).get(todayStr + ' 00:00:00').t;
  const todayVisitors   = db.prepare(`SELECT COUNT(DISTINCT session_id) as c FROM page_views WHERE created_at >= ? AND session_id IS NOT NULL`).get(todayStr + ' 00:00:00').c;

  res.json({ pendingOrders, unreadEnquiries, todayOrders, todayRevenue, todayVisitors });
});

module.exports = router;
