(function () {
  'use strict';

  var GCLID_KEY = 'krispies_gclid';
  var GCLID_TTL = 90 * 24 * 60 * 60 * 1000; // 90 days in ms

  function setCookie(name, value, msExpiry) {
    var expires = new Date(Date.now() + msExpiry).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) +
      '; expires=' + expires +
      '; path=/; SameSite=Lax';
  }

  function captureGclid() {
    var params = new URLSearchParams(window.location.search);
    var gclid = params.get('gclid');
    if (!gclid) return;
    try {
      localStorage.setItem(GCLID_KEY, gclid);
    } catch (_) {}
    setCookie(GCLID_KEY, gclid, GCLID_TTL);
  }

  function getStoredGclid() {
    try {
      return localStorage.getItem(GCLID_KEY) || '';
    } catch (_) {
      return '';
    }
  }

  function appendRefToWaLinks() {
    var gclid = getStoredGclid();
    if (!gclid) return;
    var ref = '[ref: ' + gclid.slice(-8) + ']';
    document.querySelectorAll('a[href*="wa.me"]').forEach(function (a) {
      try {
        var u = new URL(a.href);
        var text = u.searchParams.get('text') || '';
        if (text.indexOf('[ref:') === -1) {
          u.searchParams.set('text', text + ' ' + ref);
          a.href = u.toString();
        }
      } catch (_) {}
    });
  }

  captureGclid();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', appendRefToWaLinks);
  } else {
    appendRefToWaLinks();
  }
})();
