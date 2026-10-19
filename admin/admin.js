'use strict';

/* ================================================
   Krispie's Admin — Shared Utilities
   ================================================ */

const BACKEND_URL = 'https://krispies-website.onrender.com';
const SESSION_KEY = 'krispies_admin_token';

// ── AUTH ──────────────────────────────────────────
function _decodeJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); }
  catch { return null; }
}

function checkAuth() {
  const token = sessionStorage.getItem(SESSION_KEY);
  if (!token) { window.location.href = '/admin/index.html'; return false; }
  const payload = _decodeJwt(token);
  if (!payload || payload.exp * 1000 < Date.now()) {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = '/admin/index.html';
    return false;
  }
  return true;
}

function authHeader() {
  return { 'Authorization': 'Bearer ' + sessionStorage.getItem(SESSION_KEY) };
}

async function login(password) {
  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password }),
  });
  if (!res.ok) return false;
  const { token } = await res.json();
  sessionStorage.setItem(SESSION_KEY, token);
  setupPushAfterLogin();
  return true;
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = '/admin/index.html';
}

// ── API FETCH ─────────────────────────────────────
// Central fetch wrapper — handles auth headers, JSON, and errors
async function apiFetch(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
  };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  const res = await fetch(BACKEND_URL + path, opts);
  if (res.status === 401) { logout(); throw new Error('Session expired'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

// ── ID GENERATOR ──────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ── FORMAT HELPERS ────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }); }
  catch { return iso; }
}
function fmtDT(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }); }
  catch { return iso; }
}
function fmtPrice(n) {
  if (n === null || n === undefined || n === '') return '—';
  return '₹' + Number(n).toLocaleString('en-IN');
}
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── LABEL MAPS ────────────────────────────────────
const CATEGORY_LABELS = {
  'birthday-cakes':           'Birthday Cakes',
  'wedding-cakes':            'Wedding Cakes',
  'engagement-cakes':         'Engagement Cakes',
  'baby-shower-cakes':        'Baby Shower Cakes',
  'half-year-birthday-cakes': 'Half Year Birthday Cakes',
  'gender-reveal-cakes':      'Gender Reveal Cakes',
  'bento-cakes':              'Bento Cakes',
  'customized-cakes':         'Customized Cakes',
  'floral-cakes':             'Floral Cakes',
  'love-cakes':               'Love Cakes (Him/Her)',
  'super-hero-cakes':         'Super Hero Cakes',
  'anime-cakes':              'Anime Cakes',
  'number-alphabet-cakes':    'Number & Alphabet Cakes',
  'bon-voyage-cakes':         'Bon Voyage Cakes',
  'trending-cakes':           'Trending Cakes',
  'cheesecakes':              'Cheesecakes',
  'donuts':                   'Donuts',
  'flowers-bouquets':         'Flowers & Bouquets',
  'biscuits':                 'Biscuits',
  'rakhi-hampers':            'Rakhi & Sweets Hampers',
};
const TAG_LABELS = {
  'bestseller': 'Bestseller',
  'new':        'New',
  'seasonal':   'Seasonal',
  'custom':     'Made to Order',
};
const EVENT_LABELS = {
  'birthday':    'Birthday',
  'wedding':     'Wedding',
  'anniversary': 'Anniversary',
  'baby-shower': 'Baby Shower',
  'corporate':   'Corporate',
  'graduation':  'Graduation',
  'festival':    'Festival',
  'wholesale':   'Wholesale / B2B',
  'other':       'Other',
};
const OUTLET_LABELS = {
  'lalbazar':   'Lalbazar',
  'suchitra':   'Suchitra',
  'boduppal':   'Boduppal',
  'ramantapur': 'Ramantapur',
  'tukkuguda':  'Tukkuguda',
  'any':        'Any / Delivery',
};
const PLATFORM_LABELS = {
  'website':  'Website',
  'phone':    'Phone',
  'walk-in':  'Walk-in',
  'bulk':     'Bulk / Corporate',
};

// ── BADGES ────────────────────────────────────────
function statusBadge(status) {
  const map = {
    unread:    ['Unread',    'badge-unread'],
    read:      ['Read',      'badge-read'],
    responded: ['Responded', 'badge-responded'],
    pending:   ['Pending',   'badge-pending'],
    confirmed: ['Confirmed', 'badge-confirmed'],
    ready:     ['Ready',     'badge-ready'],
    delivered: ['Delivered', 'badge-delivered'],
    cancelled: ['Cancelled', 'badge-cancelled'],
  };
  const [label, cls] = map[status] || [status, ''];
  return `<span class="badge ${cls}">${label}</span>`;
}

function tagBadge(tag) {
  if (!tag) return '<span class="badge badge-none">—</span>';
  const cls = { bestseller:'badge-best', new:'badge-new', seasonal:'badge-seasonal', custom:'badge-custom' }[tag] || '';
  return `<span class="badge ${cls}">${TAG_LABELS[tag] || tag}</span>`;
}

// ── MODAL ─────────────────────────────────────────
function openModal(title, bodyHTML, onSave, saveLabel = 'Save') {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHTML;
  const saveBtn = document.getElementById('modalSaveBtn');
  if (saveBtn) { saveBtn.textContent = saveLabel; saveBtn.onclick = onSave; }
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

// ── TOAST ─────────────────────────────────────────
function showToast(msg, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  const icons = { success:'✓', error:'✕', info:'ℹ' };
  t.innerHTML = `<span class="toast__icon">${icons[type]||'✓'}</span><span>${msg}</span>`;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast--show'));
  setTimeout(() => { t.classList.remove('toast--show'); setTimeout(() => t.remove(), 350); }, 3500);
}

// ── API FETCH ─────────────────────────────────────
async function apiFetch(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BACKEND_URL + path, opts);
  if (res.status === 401) { logout(); return; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

// ── ESCAPE HTML ────────────────────────────────────
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── ESCAPE FOR INLINE onclick="fn('...')" ARGUMENTS ────────────────────────
// esc() alone is NOT safe inside an inline event-handler attribute: the
// browser HTML-decodes the attribute value (turning &#39; back into ') before
// handing it to the JS parser, so an HTML-escaped quote does not stop a user
// -controlled string from breaking out of the surrounding '...' JS literal.
// This escapes backslashes/quotes so they survive that decode step intact,
// then applies esc() on top so the value is also safe as HTML attribute text.
function escJsAttr(str) {
  if (str == null) return '';
  return esc(String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n'));
}

// ── SIDEBAR ACTIVE ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const page = window.location.pathname.split('/').pop();
  document.querySelectorAll('.sidebar__link').forEach(a => {
    if (a.getAttribute('href') === page) a.classList.add('active');
  });
});

// ── PUSH NOTIFICATIONS ────────────────────────────
// Registers a service worker and subscribes the admin browser to Web Push so
// a notification fires on every new confirmed (paid) order, even if this tab
// is in the background or closed. Runs silently — never blocks page load.

const PUSH_SUB_KEY = 'krispies_push_subscribed';

async function _urlBase64ToUint8Array(base64) {
  const pad  = '='.repeat((4 - base64.length % 4) % 4);
  const b64  = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw  = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function initPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (!sessionStorage.getItem(SESSION_KEY)) return; // not logged in yet

  try {
    // Register the service worker (no-op if already registered)
    const reg = await navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' });

    // Fetch VAPID public key
    const res = await fetch(`${BACKEND_URL}/api/push/vapid-public-key`);
    if (!res.ok) return; // not configured — skip silently
    const { publicKey } = await res.json();

    // Check existing subscription
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      // First time — ask permission
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;

      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: await _urlBase64ToUint8Array(publicKey),
      });
    }

    // Save subscription on backend (idempotent — safe to call on every login)
    await fetch(`${BACKEND_URL}/api/push/subscribe`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body:    JSON.stringify(sub.toJSON()),
    });

    localStorage.setItem(PUSH_SUB_KEY, '1');
  } catch (_) {
    // Silently ignore — push is a nice-to-have, not a blocker
  }
}

// Called from login() after a successful auth — start push setup
async function setupPushAfterLogin() {
  // Small delay so the page has time to store the token first
  setTimeout(initPushNotifications, 500);
}

// Run on every admin page load when already logged in
document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem(SESSION_KEY)) initPushNotifications();
});
