'use strict';

const db = require('../db/database');

let _webpush = null;

function getWebPush() {
  if (_webpush) return _webpush;
  try { _webpush = require('web-push'); } catch (_) { return null; }
  const publicKey  = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email      = process.env.ADMIN_EMAIL || 'admin@krispies.in';
  if (!publicKey || !privateKey) return null;
  _webpush.setVapidDetails(`mailto:${email}`, publicKey, privateKey);
  return _webpush;
}

async function sendOrderPush(order) {
  const wp = getWebPush();
  if (!wp) return;

  const subs = db.prepare('SELECT * FROM push_subscriptions').all();
  if (!subs.length) return;

  const amount = order.amount != null
    ? '₹' + Number(order.amount).toLocaleString('en-IN')
    : '';
  const payload = JSON.stringify({
    title: '🎂 New Paid Order!',
    body:  `${order.customer_name} — ${order.items}${amount ? ' · ' + amount : ''}`,
    url:   '/admin/orders.html',
  });

  for (const sub of subs) {
    try {
      await wp.sendNotification(
        { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
        payload,
      );
    } catch (err) {
      // Subscription gone (browser uninstalled / cleared) — clean it up
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
      }
    }
  }
}

module.exports = { sendOrderPush };
