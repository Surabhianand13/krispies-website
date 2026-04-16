/* ================================================
   KRISPIE'S — Admin Shared Utilities
   ================================================ */

'use strict';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIG  ← Change the password here
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ADMIN_PASSWORD = 'krispies2024';
const SESSION_KEY    = 'krispies_admin_auth';

const KEYS = {
  products:  'krispies_products',
  enquiries: 'krispies_enquiries',
  orders:    'krispies_orders',
};

// ── AUTH ──────────────────────────────────
function checkAuth() {
  if (!sessionStorage.getItem(SESSION_KEY)) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}
function login(pw) {
  if (pw === ADMIN_PASSWORD) {
    sessionStorage.setItem(SESSION_KEY, '1');
    return true;
  }
  return false;
}
function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = 'index.html';
}

// ── ID GENERATOR ──────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── LOCAL STORAGE ─────────────────────────
function getData(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}
function setData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ── SEED DEFAULT PRODUCTS ─────────────────
function initDefaults() {
  if (localStorage.getItem(KEYS.products)) return;
  const now = new Date().toISOString();
  const products = [
    // Customized Cakes
    { id: uid(), name: 'Wedding Cakes',           category: 'customized-cakes', description: 'Multi-tiered masterpieces with floral, royal or modern designs. Fully customizable flavours, fillings and fondant art.', tag: 'custom',      featured: true,  active: true, createdAt: now },
    { id: uid(), name: 'Anniversary Cakes',        category: 'customized-cakes', description: 'Celebrate milestones with a cake as special as your love story — personalized message, date & design.',                  tag: 'bestseller', featured: true,  active: true, createdAt: now },
    { id: uid(), name: 'Baby Shower Cakes',        category: 'customized-cakes', description: 'Adorable, whimsical cakes to welcome the newest member of your family. Gender reveal options available.',                  tag: 'custom',     featured: false, active: true, createdAt: now },
    { id: uid(), name: 'Corporate Event Cakes',    category: 'customized-cakes', description: 'Brand-logo cakes, office celebration cakes, and bulk dessert platters for conferences and launches.',                      tag: 'custom',     featured: false, active: true, createdAt: now },
    { id: uid(), name: 'Graduation Cakes',         category: 'customized-cakes', description: 'Mark the milestone with pride. Custom mortarboard and scroll designs in your favourite flavours.',                         tag: 'seasonal',   featured: false, active: true, createdAt: now },
    // Birthday Cakes
    { id: uid(), name: 'Classic Vanilla Dream',    category: 'birthday-cakes',   description: 'Moist vanilla sponge layered with silky buttercream — a timeless favourite loved by every generation.',                    tag: 'bestseller', featured: true,  active: true, createdAt: now },
    { id: uid(), name: 'Chocolate Overload',       category: 'birthday-cakes',   description: 'Dark chocolate sponge, ganache drip, and chocolate shards for the ultimate chocoholic celebration.',                       tag: 'bestseller', featured: true,  active: true, createdAt: now },
    { id: uid(), name: 'Red Velvet Royale',        category: 'birthday-cakes',   description: 'Striking red velvet layers with luscious cream cheese frosting — dramatic, decadent, and unforgettable.',                  tag: 'bestseller', featured: true,  active: true, createdAt: now },
    { id: uid(), name: 'Fruit Fiesta',             category: 'birthday-cakes',   description: 'Fresh seasonal fruits, light chantilly cream, and a vanilla sponge — refreshing, vibrant and beautiful.',                  tag: 'new',        featured: false, active: true, createdAt: now },
    { id: uid(), name: 'Theme Cakes',              category: 'birthday-cakes',   description: 'Superheroes, unicorns, sports, movies — any theme your heart desires, sculpted in cake form.',                             tag: 'custom',     featured: false, active: true, createdAt: now },
    { id: uid(), name: 'Black Forest Bliss',       category: 'birthday-cakes',   description: 'Classic Black Forest with cherries, whipped cream and dark chocolate — a heritage recipe baked fresh.',                    tag: 'bestseller', featured: false, active: true, createdAt: now },
    // Biscuits
    { id: uid(), name: 'Butter Cookies',           category: 'biscuits',         description: 'Rich, melt-in-the-mouth butter cookies using a recipe perfected over three decades.',                                       tag: 'bestseller', featured: true,  active: true, createdAt: now },
    { id: uid(), name: 'Osmania Biscuits',         category: 'biscuits',         description: 'The iconic Hyderabadi biscuit — slightly sweet, perfectly crisp, made for dunking into chai.',                             tag: 'bestseller', featured: true,  active: true, createdAt: now },
    { id: uid(), name: 'Nan Khatai',               category: 'biscuits',         description: 'Traditional shortbread with a hint of cardamom and ghee — the original comfort biscuit.',                                  tag: 'bestseller', featured: false, active: true, createdAt: now },
    { id: uid(), name: 'Jeera Biscuits',           category: 'biscuits',         description: 'Savoury cumin-spiced biscuits — a beloved Iyengar bakery staple for evening tea.',                                         tag: null,         featured: false, active: true, createdAt: now },
    { id: uid(), name: 'Coconut Cookies',          category: 'biscuits',         description: 'Crispy, golden-edged cookies with tropical coconut flavour and a satisfying crunch.',                                       tag: 'seasonal',   featured: false, active: true, createdAt: now },
    { id: uid(), name: 'Choco-Chip Cookies',       category: 'biscuits',         description: 'Golden-brown cookies packed with premium chocolate chips — a universal crowd pleaser.',                                     tag: 'new',        featured: false, active: true, createdAt: now },
    // Cheesecakes
    { id: uid(), name: 'New York Classic',         category: 'cheesecakes',      description: 'Dense, creamy, perfectly set baked cheesecake on a buttery graham cracker crust.',                                          tag: 'bestseller', featured: true,  active: true, createdAt: now },
    { id: uid(), name: 'Blueberry Cheesecake',     category: 'cheesecakes',      description: 'Classic cheesecake crowned with a vibrant, tangy blueberry compote.',                                                      tag: 'bestseller', featured: true,  active: true, createdAt: now },
    { id: uid(), name: 'Mango Cheesecake',         category: 'cheesecakes',      description: 'Tropical Alphonso mango atop a light cream cheese base — summer celebrations perfected.',                                   tag: 'seasonal',   featured: false, active: true, createdAt: now },
    { id: uid(), name: 'Oreo Cheesecake',          category: 'cheesecakes',      description: 'Creamy cheesecake with Oreo crust, chunks throughout, and crushed Oreo topping.',                                           tag: 'new',        featured: false, active: true, createdAt: now },
    { id: uid(), name: 'No-Bake Lotus Biscoff',    category: 'cheesecakes',      description: 'Velvety no-bake cheesecake with Biscoff spread and crushed caramel cookies.',                                               tag: 'bestseller', featured: false, active: true, createdAt: now },
    // Donuts
    { id: uid(), name: 'Glazed Original',          category: 'donuts',           description: 'Classic yeasted donut ring with a sheer vanilla glaze. Simple. Perfect. Timeless.',                                         tag: null,         featured: true,  active: true, createdAt: now },
    { id: uid(), name: 'Chocolate Frosted',        category: 'donuts',           description: 'Rich dark chocolate ganache on a fluffy donut.',                                                                            tag: 'bestseller', featured: true,  active: true, createdAt: now },
    { id: uid(), name: 'Strawberry Sprinkle',      category: 'donuts',           description: 'Pink strawberry glaze showered with rainbow sprinkles.',                                                                    tag: 'bestseller', featured: false, active: true, createdAt: now },
    { id: uid(), name: 'Matcha Green Tea',         category: 'donuts',           description: 'Earthy ceremonial-grade matcha glaze on a light donut.',                                                                    tag: 'new',        featured: false, active: true, createdAt: now },
    { id: uid(), name: 'Caramel Crunch',           category: 'donuts',           description: 'Buttery caramel glaze with caramelized sugar crystals.',                                                                    tag: 'new',        featured: false, active: true, createdAt: now },
  ];
  setData(KEYS.products, products);
}

// ── TOAST ─────────────────────────────────
function showToast(msg, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  t.innerHTML = `<span class="toast__icon">${icons[type] || '✓'}</span><span>${msg}</span>`;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast--show'));
  setTimeout(() => { t.classList.remove('toast--show'); setTimeout(() => t.remove(), 350); }, 3200);
}

// ── MODAL ─────────────────────────────────
function openModal(title, bodyHTML, onSave, saveLabel = 'Save') {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHTML;
  document.getElementById('modalSaveBtn').textContent = saveLabel;
  document.getElementById('modalSaveBtn').onclick = onSave;
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

// ── FORMAT HELPERS ────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDT(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const CATEGORY_LABELS = {
  'customized-cakes': 'Customized Cakes',
  'birthday-cakes':   'Birthday Cakes',
  'biscuits':         'Biscuits & Cookies',
  'cheesecakes':      'Cheesecakes',
  'donuts':           'Donuts',
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
  'corporate':   'Corporate Event',
  'graduation':  'Graduation',
  'festival':    'Festival',
  'other':       'Other',
};
const OUTLET_LABELS = {
  'lalbazar':    'Lalbazar',
  'suchitra':    'Suchitra',
  'boduppal':    'Boduppal',
  'ramantapur':  'Ramantapur',
  'tukkuguda':   'Tukkuguda',
  'any':         'Any / Delivery',
};
const PLATFORM_LABELS = {
  'zomato':   'Zomato',
  'swiggy':   'Swiggy',
  'phone':    'Phone',
  'walk-in':  'Walk-in',
  'bulk':     'Bulk / Corporate',
  'website':  'Website',
};

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

// ── SIDEBAR ACTIVE LINK ───────────────────
document.addEventListener('DOMContentLoaded', () => {
  const page = window.location.pathname.split('/').pop();
  document.querySelectorAll('.sidebar__link').forEach(a => {
    if (a.getAttribute('href') === page) a.classList.add('active');
  });
});
