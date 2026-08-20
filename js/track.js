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

  // Page view
  send('/api/analytics/track', {
    path: location.pathname,
    referrer: document.referrer || null,
    device_type: /mobile|android|iphone|ipad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
  });

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
})();
