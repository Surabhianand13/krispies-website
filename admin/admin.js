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
  if (!sessionStorage.getItem(SESSION_KEY)) { window.location.href = 'index.html'; return false; }
  return true;
}
function login(pw) {
  if (pw === ADMIN_PASSWORD) { sessionStorage.setItem(SESSION_KEY, '1'); return true; }
  return false;
}
function logout() { sessionStorage.removeItem(SESSION_KEY); window.location.href = 'index.html'; }

// ── ID GENERATOR ──────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ── LOCAL STORAGE ─────────────────────────
function getData(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } }
function setData(key, data) { localStorage.setItem(key, JSON.stringify(data)); }

// ── SEED DEFAULT PRODUCTS ─────────────────
function initDefaults() {
  if (localStorage.getItem(KEYS.products)) return;
  const now = new Date().toISOString();
  const p = (name, category, desc, tag, mrp, discount, featured) => ({
    id: uid(), name, category, description: desc, tag,
    mrp, discount: discount || 0, images: [],
    featured: !!featured, active: true, createdAt: now,
  });

  const products = [
    // ── Birthday Cakes ──────────────────────────────────────────────
    p('Classic Vanilla Dream',  'birthday-cakes',   'Moist vanilla sponge layered with silky buttercream — a timeless favourite loved by every generation.',                    'bestseller', 899,   10, true),
    p('Chocolate Overload',     'birthday-cakes',   'Dark chocolate sponge, ganache drip, and chocolate shards for the ultimate chocoholic celebration.',                       'bestseller', 999,   15, true),
    p('Red Velvet Royale',      'birthday-cakes',   'Striking red velvet layers with luscious cream cheese frosting — dramatic, decadent, and unforgettable.',                  'bestseller', 1099,  10, true),
    p('Black Forest Bliss',     'birthday-cakes',   'Classic Black Forest with cherries, whipped cream and dark chocolate — a heritage recipe baked fresh.',                    'bestseller', 999,   0,  false),
    p('Fruit Fiesta',           'birthday-cakes',   'Fresh seasonal fruits, light chantilly cream, and a vanilla sponge — refreshing, vibrant and beautiful.',                  'new',        849,   0,  false),
    p('Theme Cakes',            'birthday-cakes',   'Superheroes, unicorns, sports, movies — any theme your heart desires, sculpted in cake form.',                             'custom',     1499,  0,  false),
    p('Butterscotch Dream',     'birthday-cakes',   'Crunchy butterscotch praline layered in creamy buttercream — a nostalgic favourite for all ages.',                         null,         849,   10, false),
    p('Rainbow Funfetti',       'birthday-cakes',   'Colourful sprinkles baked right into the sponge — a party inside every slice!',                                            'new',        949,   0,  false),
    // ── Customized Cakes ────────────────────────────────────────────
    p('Photo-Print Cake',       'customized-cakes', 'Edible photo print on a moist sponge — any image, any occasion. Truly personal.',                                         'bestseller', 1299,  10, true),
    p('Floral Fondant Cake',    'customized-cakes', 'Hand-sculpted fondant blooms in your choice of colours — a showstopper for any celebration.',                              'custom',     2499,  0,  true),
    p('Character Theme Cake',   'customized-cakes', 'Kids\' favourite characters in 3-D fondant. Pure joy, guaranteed.',                                                        'custom',     1799,  0,  false),
    p('Geode Crystal Cake',     'customized-cakes', 'Rock-candy geode inlaid in rich buttercream — a true showstopper.',                                                        'new',        2999,  0,  false),
    p('Name-Script Cake',       'customized-cakes', 'Elegant piped lettering over velvet ganache. Simple and stunning.',                                                        null,         1199,  15, false),
    p('Baby Shower Cake',       'customized-cakes', 'Adorable, whimsical cakes to welcome the newest family member. Gender reveal options available.',                          'custom',     1499,  0,  false),
    // ── Wedding Cakes ───────────────────────────────────────────────
    p('Classic 2-Tier White',   'wedding-cakes',    'Elegant two-tier vanilla sponge with smooth white fondant and pearl details. Timeless bridal beauty.',                    'bestseller', 7500,  10, true),
    p('Floral 3-Tier Fondant',  'wedding-cakes',    'Three tiers of moist sponge draped in ivory fondant with hand-sculpted sugar flowers.',                                    'custom',     14000, 0,  true),
    p('Rustic Naked Cake',      'wedding-cakes',    'Semi-naked layered cake with fresh florals and berries — bohemian, warm, and utterly beautiful.',                          'new',        8500,  10, false),
    p('Gold Leaf Luxury Tier',  'wedding-cakes',    'Glamorous metallic gold fondant with real edible gold leaf. For the grandest of weddings.',                                'custom',     18000, 0,  false),
    p('Minimalist Modern Tier', 'wedding-cakes',    'Clean geometric lines, matte fondant, and a single accent bloom — contemporary elegance.',                                 'new',        9500,  0,  false),
    // ── Engagement Cakes ────────────────────────────────────────────
    p('Ring Box Cake',          'engagement-cakes', 'A showstopping ring-box sculpture cake — the perfect surprise for the big moment.',                                        'bestseller', 2999,  10, true),
    p('Heart & Roses Cake',     'engagement-cakes', 'Two-tier heart-shaped cake adorned with handmade fondant roses in your wedding colours.',                                  'bestseller', 3500,  0,  true),
    p('Gold Drip Engagement',   'engagement-cakes', 'Smooth ganache with a luxurious gold drip finish and personalised topper.',                                                'new',        2499,  15, false),
    p('Photo Collage Tier',     'engagement-cakes', 'Edible photo prints of your favourite couple moments, beautifully tier-stacked.',                                          'custom',     3999,  0,  false),
    p('Floral Wreath Cake',     'engagement-cakes', 'Buttercream painted floral wreath on a semi-naked cake — romantic and whimsical.',                                         null,         2799,  10, false),
    // ── Cheesecakes ─────────────────────────────────────────────────
    p('New York Classic',       'cheesecakes',      'Dense, creamy, perfectly set baked cheesecake on a buttery graham cracker crust.',                                         'bestseller', 699,   0,  true),
    p('Blueberry Cheesecake',   'cheesecakes',      'Classic cheesecake crowned with a vibrant, tangy blueberry compote.',                                                      'bestseller', 749,   10, true),
    p('Mango Cheesecake',       'cheesecakes',      'Tropical Alphonso mango atop a light cream cheese base — summer celebrations perfected.',                                  'seasonal',   749,   0,  false),
    p('Oreo Cheesecake',        'cheesecakes',      'Creamy cheesecake with Oreo crust, chunks throughout, and crushed Oreo topping.',                                          'new',        799,   0,  false),
    p('Lotus Biscoff',          'cheesecakes',      'Velvety no-bake cheesecake with Biscoff spread and crushed caramel cookies.',                                              'bestseller', 849,   0,  false),
    p('Strawberry Swirl',       'cheesecakes',      'Beautiful strawberry ribbons swirled through a vanilla cheesecake base.',                                                  'new',        729,   10, false),
    // ── Donuts ──────────────────────────────────────────────────────
    p('Glazed Original',        'donuts',           'The classic — perfectly yeasted donut ring with a sheer vanilla glaze. Simple. Perfect. Timeless.',                        null,         99,    0,  true),
    p('Chocolate Frosted',      'donuts',           'Rich dark chocolate ganache on a fluffy donut.',                                                                           'bestseller', 119,   0,  true),
    p('Strawberry Sprinkle',    'donuts',           'Pink strawberry glaze showered with rainbow sprinkles — fun, colourful, and guaranteed to make you smile.',                'bestseller', 119,   0,  false),
    p('Caramel Crunch',         'donuts',           'Buttery caramel glaze with caramelized sugar crystals — indulgent, golden, extraordinary.',                                'new',        129,   0,  false),
    p('Matcha Green Tea',       'donuts',           'Earthy ceremonial-grade matcha glaze on a light donut.',                                                                   'new',        129,   0,  false),
    p('Cinnamon Sugar',         'donuts',           'Warm cinnamon and sugar coating on a soft fried donut — a bakery classic that never goes out of style.',                   null,         99,    0,  false),
  ];

  setData(KEYS.products, products);
}

// ── TOAST ─────────────────────────────────
function showToast(msg, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) { container = document.createElement('div'); container.className = 'toast-container'; document.body.appendChild(container); }
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
function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }

// ── FORMAT HELPERS ────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDT(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtPrice(n) {
  if (!n && n !== 0) return '—';
  return '₹' + Number(n).toLocaleString('en-IN');
}

const CATEGORY_LABELS = {
  'birthday-cakes':   'Birthday Cakes',
  'customized-cakes': 'Customized Cakes',
  'wedding-cakes':    'Wedding Cakes',
  'engagement-cakes': 'Engagement Cakes',
  'cheesecakes':      'Cheesecakes',
  'donuts':           'Donuts',
};
const CATEGORY_EMOJI = {
  'birthday-cakes':   '🎂',
  'customized-cakes': '🎨',
  'wedding-cakes':    '💍',
  'engagement-cakes': '💐',
  'cheesecakes':      '🍰',
  'donuts':           '🍩',
};
const TAG_LABELS = {
  'bestseller': 'Bestseller',
  'new':        'New',
  'seasonal':   'Seasonal',
  'custom':     'Made to Order',
};
const EVENT_LABELS = {
  'birthday':    'Birthday',   'wedding':     'Wedding',
  'anniversary': 'Anniversary','baby-shower':  'Baby Shower',
  'corporate':   'Corporate Event', 'graduation': 'Graduation',
  'festival':    'Festival',   'other':       'Other',
};
const OUTLET_LABELS = {
  'lalbazar': 'Lalbazar', 'suchitra': 'Suchitra', 'boduppal': 'Boduppal',
  'ramantapur': 'Ramantapur', 'tukkuguda': 'Tukkuguda', 'any': 'Any / Delivery',
};
const PLATFORM_LABELS = {
  'zomato': 'Zomato', 'swiggy': 'Swiggy', 'phone': 'Phone',
  'walk-in': 'Walk-in', 'bulk': 'Bulk / Corporate', 'website': 'Website',
};

function statusBadge(status) {
  const map = {
    unread:['Unread','badge-unread'], read:['Read','badge-read'], responded:['Responded','badge-responded'],
    pending:['Pending','badge-pending'], confirmed:['Confirmed','badge-confirmed'],
    ready:['Ready','badge-ready'], delivered:['Delivered','badge-delivered'], cancelled:['Cancelled','badge-cancelled'],
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
