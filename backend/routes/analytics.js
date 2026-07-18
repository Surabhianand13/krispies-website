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

  // Selected range for the admin analytics range tabs (Today / 7d / 30d / All time).
  // Defaults to 7 days so existing callers (e.g. the dashboard) keep their prior window.
  const daysParam = parseInt(req.query.days, 10);
  const selectedDays = Number.isFinite(daysParam) ? daysParam : 7;
  const selectedFrom = selectedDays === 1 ? ranges.today
    : selectedDays > 0 ? dateStr(selectedDays)
    : '1970-01-01 00:00:00';
  const prevFrom = selectedDays === 1 ? ranges.yesterday
    : selectedDays > 0 ? dateStr(selectedDays * 2)
    : null;
  const prevViews    = prevFrom ? viewsInRange(prevFrom, selectedFrom) : null;
  const prevVisitors = prevFrom ? uniqueInRange(prevFrom, selectedFrom) : null;

  // Top pages for the selected range
  const topPages = db.prepare(`
    SELECT path, COUNT(*) as views
    FROM page_views WHERE created_at >= ?
    GROUP BY path ORDER BY views DESC LIMIT 10
  `).all(selectedFrom);

  // Device split for the selected range
  const deviceSplit = db.prepare(`
    SELECT device_type, COUNT(*) as c
    FROM page_views WHERE created_at >= ?
    GROUP BY device_type
  `).all(selectedFrom);

  // Hourly distribution for the selected range
  const hourly = db.prepare(`
    SELECT strftime('%H', created_at) as hour, COUNT(*) as views
    FROM page_views WHERE created_at >= ?
    GROUP BY hour ORDER BY hour
  `).all(selectedFrom);

  // Daily trend for the selected range
  const dailyTrend = db.prepare(`
    SELECT strftime('%Y-%m-%d', created_at) as date, COUNT(*) as views,
           COUNT(DISTINCT session_id) as visitors
    FROM page_views WHERE created_at >= ?
    GROUP BY date ORDER BY date
  `).all(selectedFrom);

  // Event counts for the selected range
  const eventCounts = db.prepare(`
    SELECT type, COUNT(*) as c FROM events WHERE created_at >= ?
    GROUP BY type ORDER BY c DESC
  `).all(selectedFrom);

  // Traffic sources for the selected range — bucket raw referrer hostnames
  // into the same categories the old client-side tracker used.
  function bucketReferrer(ref) {
    if (!ref) return 'direct';
    let host;
    try { host = new URL(ref).hostname.replace(/^www\./, ''); } catch (e) { return 'direct'; }
    if (host === 'krispies.in')          return 'internal';
    if (/google/.test(host))             return 'google';
    if (/facebook|fb\.com/.test(host))   return 'facebook';
    if (/instagram/.test(host))          return 'instagram';
    if (/zomato/.test(host))             return 'zomato';
    if (/swiggy/.test(host))             return 'swiggy';
    return 'other';
  }
  const rawReferrers = db.prepare(`
    SELECT referrer, COUNT(*) as c FROM page_views WHERE created_at >= ?
    GROUP BY referrer
  `).all(selectedFrom);
  const sourceBuckets = {};
  rawReferrers.forEach(r => {
    const bucket = bucketReferrer(r.referrer);
    sourceBuckets[bucket] = (sourceBuckets[bucket] || 0) + r.c;
  });
  const sources = Object.entries(sourceBuckets)
    .map(([source, c]) => ({ source, c }))
    .sort((a, b) => b.c - a.c);

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
  const ordersTotal = db.prepare(`SELECT COUNT(*) as c FROM orders`).get().c;

  // Enquiries summary
  const enquiriesUnread = db.prepare(`SELECT COUNT(*) as c FROM messages WHERE status='unread'`).get().c;
  const enquiriesToday  = db.prepare(`SELECT COUNT(*) as c FROM messages WHERE created_at >= ?`).get(ranges.today).c;
  const enquiriesTotal  = db.prepare(`SELECT COUNT(*) as c FROM messages`).get().c;

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
    range:     { days: selectedDays, views: viewsInRange(selectedFrom), visitors: uniqueInRange(selectedFrom) },
    prevRange: prevFrom ? { views: prevViews, visitors: prevVisitors } : null,
    topPages,
    deviceSplit,
    hourly,
    dailyTrend,
    sources,
    eventCounts,
    revenue: { today: revenueToday, week: revenueWeek, month: revenueMonth },
    orders:  { summary: orderSummary, today: ordersToday, total: ordersTotal },
    enquiries: { unread: enquiriesUnread, today: enquiriesToday, total: enquiriesTotal },
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
