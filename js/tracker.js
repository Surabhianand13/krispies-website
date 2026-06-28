/* ================================================
   KRISPIE'S — Page Visit Tracker
   Stores visits in localStorage for admin analytics.
   Keeps last 5 000 events; trims oldest on overflow.
   ================================================ */
(function () {
  'use strict';

  var STORE_KEY = 'krispies_analytics';
  var MAX_EVENTS = 5000;

  function device() {
    var ua = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
    if (/mobile|android|iphone|ipod|blackberry|opera mini|windows phone/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  function referrerSource() {
    var ref = document.referrer;
    if (!ref) return 'direct';
    try {
      var host = new URL(ref).hostname.replace(/^www\./, '');
      if (host === 'krispies.in') return 'internal';
      if (/google/.test(host))    return 'google';
      if (/facebook|fb\.com/.test(host)) return 'facebook';
      if (/instagram/.test(host)) return 'instagram';
      if (/zomato/.test(host))    return 'zomato';
      if (/swiggy/.test(host))    return 'swiggy';
      return host;
    } catch (e) { return 'direct'; }
  }

  function pageName() {
    var path = window.location.pathname;
    var slug = path.split('/').filter(Boolean).pop() || 'index';
    return slug.replace(/\.html$/, '') || 'index';
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { return []; }
  }

  function save(events) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(events)); } catch (e) {}
  }

  var events = load();
  events.push({
    page:   pageName(),
    ts:     Date.now(),
    device: device(),
    ref:    referrerSource(),
  });
  if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
  save(events);
})();
