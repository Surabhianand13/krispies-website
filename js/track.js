/* Krispie's — lightweight analytics tracker. Never blocks the page. */
(function () {
  var API = 'https://krispies-website.onrender.com';

  function sid() {
    try {
      var k = 'kr_sid', v = localStorage.getItem(k);
      if (!v) { v = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); localStorage.setItem(k, v); }
      return v;
    } catch (e) { return null; }
  }

  // Persist UTM params from the landing URL so they survive to checkout
  function getUtm() {
    try {
      var p = new URLSearchParams(location.search);
      var src = p.get('utm_source'), med = p.get('utm_medium'), cam = p.get('utm_campaign');
      var stored;
      try { stored = JSON.parse(localStorage.getItem('kr_utm') || 'null'); } catch(_) {}
      // Fresh UTM params on this URL override what's stored
      if (src) {
        var fresh = { utm_source: src, utm_medium: med || null, utm_campaign: cam || null };
        try { localStorage.setItem('kr_utm', JSON.stringify(fresh)); } catch(_) {}
        return fresh;
      }
      return stored || {};
    } catch (e) { return {}; }
  }

  function send(endpoint, data) {
    try {
      var payload = JSON.stringify(Object.assign({ session_id: sid() }, data));
      if (navigator.sendBeacon) {
        navigator.sendBeacon(API + endpoint, new Blob([payload], { type: 'application/json' }));
      } else {
        fetch(API + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(function(){});
      }
    } catch (e) {}
  }

  // Page view — include UTM attribution
  var utm = getUtm();
  send('/api/analytics/track', Object.assign({
    path: location.pathname,
    referrer: document.referrer || null,
    device_type: /mobile|android|iphone|ipad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
  }, utm));

  // Auto-capture clicks
  document.addEventListener('click', function (e) {
    var el = e.target.closest('a, button');
    if (!el) return;
    var href = el.getAttribute('href') || '';
    var txt  = (el.textContent || '').trim().slice(0, 60);
    var type = null;

    if (href.indexOf('wa.me') !== -1 || href.indexOf('whatsapp') !== -1) type = 'whatsapp_click';
    else if (href.indexOf('tel:') === 0) type = 'call_click';
    else if (/order|buy|checkout|cart/i.test(txt + href))                type = 'order_click';
    else if (/menu/i.test(txt + href))                                   type = 'menu_click';

    if (type) send('/api/analytics/event', { type: type, label: txt, path: location.pathname });
  }, true);

  window.krTrack = function(type, label, meta) {
    send('/api/analytics/event', { type: type, label: label || null, path: location.pathname, meta: meta || null });
  };

  // Called by shop.js _commitToCart — fires add_to_cart event
  window.krTrackAddToCart = function(product, qty, price) {
    if (!product) return;
    send('/api/analytics/event', {
      type: 'add_to_cart',
      label: (product.name || '').slice(0, 60),
      path: location.pathname,
      meta: { category: product.category || null, price: price || 0, qty: qty || 1 },
    });
  };
})();
