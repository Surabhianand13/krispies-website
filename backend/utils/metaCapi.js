'use strict';

const crypto = require('crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

/* Fire-and-forget server-side Purchase event for Meta Conversions API.
   Matched to the client-side Pixel hit via event_id (the order id) so Meta
   de-duplicates the two into a single conversion. No-ops silently until
   META_PIXEL_ID / META_CAPI_ACCESS_TOKEN are set (see .env.example). */
async function sendPurchaseEvent(order, req) {
  const pixelId     = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !accessToken) return;

  const userData = {};
  if (order.customer_email) userData.em = [sha256(order.customer_email)];
  if (order.customer_phone) userData.ph = [sha256(order.customer_phone.replace(/\D/g, ''))];
  if (req?.ip) userData.client_ip_address = req.ip;
  const ua = req?.headers?.['user-agent'];
  if (ua) userData.client_user_agent = ua;

  const payload = {
    data: [{
      event_name:       'Purchase',
      event_time:       Math.floor(Date.now() / 1000),
      event_id:         String(order.id),
      action_source:    'website',
      event_source_url: 'https://www.krispies.in/',
      user_data:        userData,
      custom_data: {
        currency: 'INR',
        value:    Number(order.amount),
        order_id: String(order.id),
      },
    }],
    access_token: accessToken,
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) console.error('[Meta CAPI] Purchase event rejected:', await res.text());
  } catch (err) {
    console.error('[Meta CAPI] Purchase event failed:', err.message || err);
  }
}

module.exports = { sendPurchaseEvent };
