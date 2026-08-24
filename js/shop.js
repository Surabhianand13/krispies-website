/* ════════════════════════════════════════════════════════════════════════
   Krispie's — shared product / cart / checkout logic
   Loaded by menu.html and every category landing page (birthday-cakes.html,
   wedding-cakes.html, engagement-cakes.html, baby-shower-cakes.html,
   half-year-birthday-cakes.html, gender-reveal-cakes.html) and
   product-page.html. Requires BACKEND_URL from
   js/main.js to already be loaded on the page.
   ════════════════════════════════════════════════════════════════════════ */

/* ── DATA ── */
const PROD_KEY = 'krispies_products'; // offline fallback cache only — source of truth is the backend

const TAG_LABELS = { bestseller:'Bestseller', new:'New', seasonal:'Seasonal', custom:'Made to Order' };
const CAT_SVG = {
  'birthday-cakes':        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg>',
  'wedding-cakes':         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  'engagement-cakes':      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg>',
  'baby-shower-cakes':     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  'half-year-birthday-cakes': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  'gender-reveal-cakes':      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13"/><path d="M19 8V6a3 3 0 0 0-6 0 3 3 0 0 0-6 0v2"/></svg>',
  'customized-cakes':      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>',
  'floral-cakes':          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2a3 3 0 0 1 0 6 3 3 0 0 1 0-6zM12 16a3 3 0 0 1 0 6 3 3 0 0 1 0-6zM2 12a3 3 0 0 1 6 0 3 3 0 0 1-6 0zM16 12a3 3 0 0 1 6 0 3 3 0 0 1-6 0z"/></svg>',
  'love-cakes':            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  'cheesecakes':           '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>',
  'donuts':                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>',
  'biscuits':              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1"/><circle cx="14" cy="9" r="1"/><circle cx="15" cy="14" r="1"/></svg>',
  'rakhi-hampers':         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8a4 4 0 1 0-4-4c0 2 4 4 4 4Z"/><path d="M12 8a4 4 0 1 1 4-4c0 2-4 4-4 4Z"/><path d="M12 8v13"/><path d="M8 21h8"/></svg>',
};
const CAT_EMOJI = CAT_SVG; // backwards-compat alias

/* ── Variant option cards (Rakhi & Sweets Hampers) ──────────────────────────
   Every other category still uses a plain <select> for variant groups (see
   the `else` branch wherever this is called) -- this richer, image-style
   card picker is opt-in per category (currently just 'rakhi-hampers') so it
   doesn't change the tested selection UI on every other product's page.
   Option data only carries {label, price} today, no per-option photo, so
   each card shows a small icon guessed from the group/option text instead
   of a real product photo -- swap VARIANT_ICONS[key] for an <img> once real
   per-variant photography exists. */
const VARIANT_ICONS = {
  rakhi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8a4 4 0 1 0-4-4c0 2 4 4 4 4Z"/><path d="M12 8a4 4 0 1 1 4-4c0 2-4 4-4 4Z"/><path d="M12 8v13"/><path d="M8 21h8"/></svg>',
  laddu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="9" cy="9" r="0.9" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="0.9" fill="currentColor" stroke="none"/><circle cx="10" cy="15" r="0.9" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="0.9" fill="currentColor" stroke="none"/></svg>',
  barfi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 22 12 12 22 2 12Z"/><path d="M12 7v10"/><path d="M7 12h10"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13"/><path d="M19 8V6a3 3 0 0 0-6 0 3 3 0 0 0-6 0v2"/></svg>',
  cupcake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21h16"/><path d="M5 21 7 10h10l2 11"/><path d="M12 10c-2 0-3-1.5-3-3a3 3 0 0 1 6 0c0 1.5-1 3-3 3Z"/></svg>',
  sweet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="14" height="8" rx="4"/><path d="M5 13H2M22 13h-3M8 9l-1.5-3M16 9l1.5-3"/></svg>',
  none: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
};
function _variantOptionIconKey(groupName, label) {
  const g = (groupName || '').toLowerCase();
  const l = (label || '').toLowerCase();
  if (/rakhi/.test(g) || /rakhi/.test(l)) return 'rakhi';
  if (/laddu/.test(l)) return 'laddu';
  if (/katli|barfi/.test(l)) return 'barfi';
  if (/box|mithai|dry fruit/.test(l)) return 'box';
  if (/chocolate|cupcake|cake/.test(l)) return 'cupcake';
  return 'sweet';
}

// Renders one variant group as a grid of clickable image-style cards
// (icon + label + price) instead of a <select> -- used for categories
// where CATEGORIES_WITH_VARIANT_CARDS opts in. `onclickFn` is the name of
// the page-specific handler to call (e.g. '_pdpVariantCardClick' on the
// product page, '_chkVariantCardClick' inside the checkout modal).
const CATEGORIES_WITH_VARIANT_CARDS = ['rakhi-hampers'];

const RK_CHEVRON_LEFT  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
const RK_CHEVRON_RIGHT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

// IGP-style "Select Variant" strip: a photo box (real upload, else an
// auto-picked icon) with the label/price left-aligned underneath, in a
// horizontally scrollable row with chevron buttons -- rather than the
// generic small icon-circle cards this replaces.
function renderVariantCards(groupName, group, selectedIndex, onclickFn, groupIdx) {
  const scrollId = `rkvc-${onclickFn}-${groupIdx}`;
  const noneCard = group.optional ? `
    <div class="rk-vcard${selectedIndex === -1 ? ' selected' : ''}" onclick="${onclickFn}('${escJsStr(groupName)}', -1, ${groupIdx})">
      <div class="rk-vcard__img rk-vcard__img--none">${VARIANT_ICONS.none}</div>
      <div class="rk-vcard__info">
        <div class="rk-vcard__label">None</div>
      </div>
    </div>` : '';
  const optionCards = group.options.map((o, i) => {
    const key = _variantOptionIconKey(groupName, o.label);
    // Uploaded per-option photo takes priority over the auto-picked icon;
    // a hidden fallback icon swaps in if the photo URL 404s/fails to load.
    // The fallback uses one consistent soft brand tint (not a per-option
    // rainbow colour) so a still-photoless option reads as an intentional
    // "photo coming soon" placeholder next to cards that do have a real
    // photo, rather than a clashing block of flat colour.
    const imgHtml = o.image
      ? `<img src="${esc(o.image)}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
         <span class="rk-vcard__img-fallback">${VARIANT_ICONS[key]}</span>`
      : VARIANT_ICONS[key];
    return `
    <div class="rk-vcard${selectedIndex === i ? ' selected' : ''}" onclick="${onclickFn}('${escJsStr(groupName)}', ${i}, ${groupIdx})">
      <div class="rk-vcard__img${o.image ? ' rk-vcard__img--photo' : ' rk-vcard__img--icon'}">${imgHtml}</div>
      <div class="rk-vcard__info">
        <div class="rk-vcard__label">${esc(o.label)}</div>
        <div class="rk-vcard__price">₹${(Number(o.price) || 0).toLocaleString('en-IN')}</div>
      </div>
    </div>`;
  }).join('');
  return `
    <div class="chk-field-group">
      <label class="chk-label">${esc(groupName)}</label>
      <div class="rk-vcards-wrap">
        <div class="rk-vcards" id="${scrollId}">${noneCard}${optionCards}</div>
        <button type="button" class="rk-vcards-nav rk-vcards-nav--prev" onclick="_rkScrollCards('${scrollId}', -1)" aria-label="Scroll left">${RK_CHEVRON_LEFT}</button>
        <button type="button" class="rk-vcards-nav rk-vcards-nav--next" onclick="_rkScrollCards('${scrollId}', 1)" aria-label="Scroll right">${RK_CHEVRON_RIGHT}</button>
      </div>
    </div>`;
}

function _rkScrollCards(id, dir) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
}

// esc() alone isn't safe inside a single-quoted inline onclick="fn('...')"
// argument -- see admin.js's escJsAttr for the same issue/fix. Group names
// here are short, fixed, admin-authored strings, but this keeps the pattern
// consistent and safe regardless.
function escJsStr(str) {
  return String(str == null ? '' : str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/* ── Cloudflare Turnstile ──────────────────────────────────────────────────
   Shared across every form that takes a phone number or email (checkout,
   account signup/login/OTP, the "can't find it" quote form). Skips itself
   entirely -- rendering nothing and sending no token -- until TURNSTILE_SITE_KEY
   in main.js is replaced with a real key, so nothing breaks before that's
   set up. The backend mirrors this: it skips verification (rather than
   rejecting requests) whenever its matching secret isn't configured either. */
const turnstileConfigured = typeof TURNSTILE_SITE_KEY === 'string' && !TURNSTILE_SITE_KEY.startsWith('REPLACE_');

let _turnstileScriptPromise = null;
function _loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  if (_turnstileScriptPromise) return _turnstileScriptPromise;
  _turnstileScriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true; s.defer = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Turnstile script failed to load'));
    document.head.appendChild(s);
  });
  return _turnstileScriptPromise;
}

// Renders a fresh widget into containerEl (a plain empty <div>) and returns
// its widget ID, needed to read back the token at submit time. Call this
// every time the form's HTML is (re)rendered -- replacing a container's
// innerHTML destroys any widget previously mounted inside it.
async function renderTurnstile(containerEl) {
  if (!turnstileConfigured || !containerEl) return null;
  try {
    await _loadTurnstileScript();
    containerEl.innerHTML = '';
    return window.turnstile.render(containerEl, { sitekey: TURNSTILE_SITE_KEY });
  } catch (_) {
    return null; // network hiccup loading the widget -- treat as unconfigured, don't block the form
  }
}

// Empty string when Turnstile isn't configured/loaded -- the backend
// treats a missing token the same way (skips the check) in that case.
function getTurnstileToken(widgetId) {
  if (!turnstileConfigured || !window.turnstile || widgetId == null) return '';
  try { return window.turnstile.getResponse(widgetId) || ''; } catch (_) { return ''; }
}

// Tokens are single-use -- call this after a failed submit so the widget
// re-arms itself for the retry instead of resending an already-spent token.
function resetTurnstile(widgetId) {
  if (!turnstileConfigured || !window.turnstile || widgetId == null) return;
  try { window.turnstile.reset(widgetId); } catch (_) {}
}

/* ── Product loading — backend is the source of truth; localStorage is only
   an offline fallback cache written after every successful fetch. ── */
let _productsCache = [];

function getProducts() {
  return _productsCache;
}

// Retries a fetch a few times with short delays before giving up. Render's
// free tier spins the backend down after ~15 min idle, and the first
// request after that can hit the platform's gateway timeout (a non-OK
// response) while the container is still waking up, typically for
// 20-30 seconds. A single-attempt fetch treats that as a permanent
// failure and falls back to (often empty, for a first-time visitor)
// localStorage forever, with no error visible anywhere and no way for the
// page to recover short of a manual refresh -- this makes a cold start
// just take a few extra seconds instead of silently showing no products.
async function _fetchWithRetry(url, delays = [0, 4000, 8000, 12000]) {
  let lastErr;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await new Promise(r => setTimeout(r, delays[i]));
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Bad response: ' + res.status);
      return await res.json();
    } catch (err) { lastErr = err; }
  }
  throw lastErr;
}

async function loadProducts() {
  try {
    const data = await _fetchWithRetry(`${BACKEND_URL}/api/products`);
    if (!Array.isArray(data)) throw new Error('Unexpected response shape');
    _productsCache = data;
    try { localStorage.setItem(PROD_KEY, JSON.stringify(data)); } catch (_) {}
  } catch (err) {
    console.warn('[shop] Could not reach backend, using cached products:', err.message);
    try { _productsCache = JSON.parse(localStorage.getItem(PROD_KEY)) || []; }
    catch (_) { _productsCache = []; }
  }
}

/* ── Variant helpers ──
   variantGroups shape: [{ name, optional, options: [{ label, price }] }] --
   each option's price is the final selling price for that choice (e.g.
   Half Kg = 699, 1 Kg = 1199), not an add-on to the base MRP/discount
   price. A group marked optional defaults to "nothing selected" (index
   -1) and contributes ₹0 unless the customer actively picks an option --
   e.g. an "Add Ons" group shouldn't silently add its price to every
   order. A non-optional group always has a real option selected (index
   0 by default), since it represents a required choice like Weight.
   A "selection" is { [groupName]: optionIndex }, -1 meaning "skipped". */
function variantDefaultSelection(p) {
  const sel = {};
  (p.variantGroups || []).forEach(g => { sel[g.name] = g.optional ? -1 : 0; });
  return sel;
}

// Final price for a given variant selection: the sum of each selected
// option's own price (not added on top of mrp/discount). With a single
// group (the common case -- weight tiers, or flavour-only pricing) this
// is just that option's price. Optional groups left unselected (-1)
// contribute nothing.
function productFinalPrice(p, selection) {
  if (!p.variantGroups || !p.variantGroups.length) return productBasePrice(p);
  const sel = selection || variantDefaultSelection(p);
  return p.variantGroups.reduce((sum, g) => {
    const idx = sel[g.name] != null ? sel[g.name] : (g.optional ? -1 : 0);
    if (idx === -1) return sum;
    const opt = g.options[idx];
    return sum + (opt ? Number(opt.price) || 0 : 0);
  }, 0);
}

function variantSelectionLabel(p, selection) {
  if (!p.variantGroups || !p.variantGroups.length) return '';
  return p.variantGroups
    .map(g => {
      const idx = selection && selection[g.name] != null ? selection[g.name] : (g.optional ? -1 : 0);
      if (idx === -1) return '';
      const opt = g.options[idx];
      return opt ? opt.label : '';
    })
    .filter(Boolean)
    .join(', ');
}

function productBasePrice(p) {
  const mrp = Number(p.mrp) || 0;
  const disc = Number(p.discount) || 0;
  return mrp ? Math.round(mrp * (1 - disc / 100)) : 0;
}

function productSlugUrl(p) {
  return `products/${encodeURIComponent(p.slug || p.id)}`;
}

/* ── RENDER ── */
function esc(s) {
  const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML;
}

// Swaps a broken product photo for the category's SVG icon. Kept as a
// named global (not an inline SVG string) because embedding raw SVG
// markup inside an onerror="" attribute breaks on the quotes the SVG
// itself needs for its own attributes.
function handleCardImgError(imgEl, category) {
  const slide = imgEl.closest('.pcard__gal-slide');
  if (slide) slide.innerHTML = `<div class="pcard__gal-placeholder">${CAT_SVG[category] || CAT_SVG['birthday-cakes']}</div>`;
}

function renderCard(p) {
  const imgs     = (p.images || []).filter(Boolean);
  const hasImgs  = imgs.length > 0;
  const placeholderIcon = CAT_SVG[p.category] || CAT_SVG['birthday-cakes'];
  const mrp      = Number(p.mrp) || 0;
  const discount = Number(p.discount) || 0;
  const final    = productBasePrice(p);
  const hasVariants = (p.variantGroups || []).length > 0;
  const priceFrom = p.priceFrom != null ? p.priceFrom : final;
  const url = productSlugUrl(p);

  const tagBadge = p.tag ? `<div class="pcard__tag-badge ${p.tag}">${esc(TAG_LABELS[p.tag] || p.tag)}</div>` : '';
  const vegBadge = `<div class="pcard__veg-badge" title="Pure Vegetarian"><span></span></div>`;

  const slideHTML = url => `<div class="pcard__gal-slide"><img src="${esc(url)}" alt="${esc(p.name)}" loading="lazy" onerror="handleCardImgError(this,'${p.category}')"></div>`;
  const placeholderSlide = `<div class="pcard__gal-slide"><div class="pcard__gal-placeholder">${placeholderIcon}</div></div>`;
  const slides = hasImgs ? imgs.map(slideHTML).join('') : placeholderSlide;

  const galleryControls = imgs.length > 1 ? `
    <button class="pcard__gal-btn pcard__gal-prev" aria-label="Previous photo">&#8249;</button>
    <button class="pcard__gal-btn pcard__gal-next" aria-label="Next photo">&#8250;</button>
    <div class="pcard__gal-dots">${imgs.map((_, i) => `<span class="pcard__gal-dot${i === 0 ? ' active' : ''}"></span>`).join('')}</div>`
    : '';

  // The discount % applies on top of variant option prices too (see
  // backend/routes/products.js's toProduct) -- priceFrom already reflects
  // it here since this is a public/customer-facing read. There's no single
  // "was" price for a variant product the way mrp is for a simple one, so
  // reverse the uniform discount off priceFrom for the strikethrough --
  // exact enough for a badge, doesn't need to be precise to the rupee.
  const wasPrice = hasVariants
    ? Math.round(priceFrom / (1 - discount / 100))
    : mrp;

  const pricingHTML = (mrp || hasVariants) ? `
    <div class="pcard__pricing">
      <span class="pcard__price">₹${(hasVariants ? priceFrom : final).toLocaleString('en-IN')}</span>
      ${discount > 0 ? `<span class="pcard__mrp">₹${wasPrice.toLocaleString('en-IN')}</span>` : ''}
      ${discount > 0 ? `<span class="pcard__discount">${discount}% OFF</span>` : ''}
    </div>`
    : `<p class="pcard__price-note">Price on request</p>`;

  const cta = (mrp > 0 || hasVariants)
    ? `<button class="pcard__btn" onclick="addToCart('${p.id}')">Add to Cart</button>`
    : `<a class="pcard__btn" href="contact" style="text-decoration:none;">Get a Quote →</a>`;

  const ratingHTML = p.ratingCount > 0 ? `
    <div class="pcard__rating">
      <span class="pcard__rating-star">★</span>
      <span class="pcard__rating-value">${p.ratingAvg}</span>
      <span class="pcard__rating-count">(${p.ratingCount})</span>
    </div>` : '';

  return `
    <div class="pcard" data-flavour="${esc((p.flavour || '').toLowerCase())}">
      <a class="pcard__gallery" href="${url}">
        <div class="pcard__gal-track">${slides}</div>
        ${tagBadge}${vegBadge}
        ${galleryControls}
      </a>
      <div class="pcard__body">
        <h3 class="pcard__name"><a href="${url}" style="text-decoration:none;color:inherit;">${esc(p.name)}</a></h3>
        ${ratingHTML}
        <p class="pcard__desc">${esc(p.description)}</p>
        ${pricingHTML}
        ${cta}
      </div>
    </div>`;
}

// grid-<x> ids that aren't real categories -- they're rendered separately
// (renderFeatured(), renderTrending()) and would otherwise get treated as an
// empty category by the [id^="grid-"] scan below.
const NON_CATEGORY_GRID_IDS = ['featured', 'trending'];

function renderAll() {
  // Categories with at least one product, plus any grid-<category> container
  // already on the page (e.g. a brand-new category page with zero products
  // yet) -- otherwise a category with no products yet never gets visited and
  // its grid is stuck on the initial "Loading cakes…" placeholder forever.
  const fromProducts = getProducts().map(p => p.category);
  const fromPage = [...document.querySelectorAll('[id^="grid-"]')]
    .map(el => el.id.replace(/^grid-/, ''))
    .filter(id => !NON_CATEGORY_GRID_IDS.includes(id));
  const categories = [...new Set([...fromProducts, ...fromPage])];
  categories.forEach(cat => {
    const grid = document.getElementById(`grid-${cat}`);
    if (!grid) return;
    const items = getProducts().filter(p => p.category === cat && p.active !== false);
    grid.innerHTML = items.length
      ? items.map(renderCard).join('')
      : `<div class="menu-empty">
           <div style="width:48px;height:48px;margin:0 auto 12px;color:var(--gold)">${CAT_SVG[cat]||CAT_SVG['birthday-cakes']}</div>
           <p>Products coming soon. Check back shortly!</p>
         </div>`;
  });
  initGalleries();
}

// Renders the flavour filter circles (e.g. "Chocolate", "Rasmalai") above a
// category grid, driven by whichever flavours are actually set on active
// products in that category via admin — instead of a hardcoded, unmanageable
// list. No-op on pages without a .subcat-scroll container.
function renderSubcatCircles() {
  document.querySelectorAll('.subcat-scroll').forEach(scroll => {
    const section = scroll.closest('.menu-cat-section');
    if (!section) return;
    const cat = section.id.replace(/^cat-/, '');
    const items = getProducts().filter(p => p.category === cat && p.active !== false);

    const seen = new Set();
    const flavours = [];
    items.forEach(p => {
      const f = (p.flavour || '').trim();
      const key = f.toLowerCase();
      if (f && !seen.has(key)) { seen.add(key); flavours.push({ label: f, key, image: (p.images || [])[0] }); }
    });

    if (!flavours.length) { scroll.style.display = 'none'; return; }

    const allImage = items.find(p => (p.images || []).length)?.images[0];
    const circle = (label, key, image, active) => `
      <a href="#" class="subcat-item${active ? ' active' : ''}" data-filter="${esc(key)}">
        <div class="subcat-item__circle">
          ${image ? `<img src="${esc(image)}" alt="${esc(label)}">` : `<div class="subcat-item__fallback" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--gold)">${CAT_SVG[cat] || CAT_SVG['birthday-cakes']}</div>`}
        </div>
        <span>${esc(label)}</span>
      </a>`;

    scroll.innerHTML = circle('All Cakes', 'all', allImage, true)
      + flavours.map(f => circle(f.label, f.key, f.image, false)).join('');
  });
}

// Renders products flagged "Featured on Homepage" in admin into
// #grid-featured, if the current page has that container (only
// index.html does). Keeps the homepage in sync with admin instead of a
// hand-maintained list of cards.
function renderFeatured() {
  const grid = document.getElementById('grid-featured');
  if (!grid) return;
  const items = getProducts().filter(p => p.featured && p.active !== false).slice(0, 8);
  grid.innerHTML = items.length
    ? items.map(renderCard).join('')
    : `<div class="menu-empty">No featured products yet.</div>`;
  initGalleries();
}

// Same pattern as renderFeatured(), for products flagged "Trending on
// Homepage" in admin, into #grid-trending (only index.html has that
// container, and only once at least one product is marked trending --
// see the section-hiding note next to #trending-section in index.html).
function renderTrending() {
  const grid = document.getElementById('grid-trending');
  if (!grid) return;
  const section = document.getElementById('trending-section');
  const items = getProducts().filter(p => p.trending && p.active !== false).slice(0, 8);
  if (section) section.style.display = items.length ? '' : 'none';
  grid.innerHTML = items.map(renderCard).join('');
  initGalleries();
}

/* ════════════════════════════════════════════════════════
   CART SYSTEM
════════════════════════════════════════════════════════ */
let _cartItems = []; // [{cartId, product, qty, addons, variantSelection, unitPrice, subtotal}]
let _pendingProductId = null;
let _pendingVariant = null; // selection object set by product-page.html before calling addToCart()
let _pendingQty = 1; // quantity set by product-page.html before calling addToCart()
let _selectedAddons = {}; // addonId -> qty

// Add-ons are admin-managed (see admin/addons.html) -- fetched once at
// boot and cached here, same pattern as products.
let _addonsCache = [];
const ADDONS_KEY = 'krispies_addons';

async function loadAddons() {
  try {
    const data = await _fetchWithRetry(`${BACKEND_URL}/api/addons`);
    if (!Array.isArray(data)) throw new Error('Unexpected response shape');
    _addonsCache = data;
    try { localStorage.setItem(ADDONS_KEY, JSON.stringify(data)); } catch (_) {}
  } catch (err) {
    console.warn('[shop] Could not reach backend for add-ons, using cache:', err.message);
    try { _addonsCache = JSON.parse(localStorage.getItem(ADDONS_KEY)) || []; }
    catch (_) { _addonsCache = []; }
  }
}

// An add-on with no categories set applies to every product; otherwise it
// only shows for the categories the admin picked.
function getAddonsForCategory(cat) {
  return _addonsCache.filter(a => !a.categories || a.categories.length === 0 || a.categories.includes(cat));
}

// Default add-on icon (gift box) — used when no image is set, and as the
// onerror fallback for a broken image URL.
const ADDON_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>';
function handleAddonImgError(imgEl) {
  const icon = imgEl.closest('.addon-card__icon');
  if (icon) icon.innerHTML = ADDON_ICON_SVG;
}

/* ── ADD TO CART FLOW ──
   variantSelection is optional — pass it from product-page.html once the user has
   picked options. Called with no selection (e.g. from a card's quick "Add to
   Cart" button), it defaults to the first option of each variant group. qty
   defaults to 1 (card buttons don't have a quantity selector). */
function addToCart(productId, variantSelection, qty) {
  _pendingProductId = productId;
  _pendingVariant = variantSelection || null;
  _pendingQty = qty || 1;
  _selectedAddons = {};
  const product = getProducts().find(p => p.id === productId);
  if (!product) return;
  const addons = getAddonsForCategory(product.category);
  const grid = document.getElementById('addonsGrid');
  if (!grid) { _commitToCart([]); return; } // page has no addons modal (e.g. product-page.html) — commit straight away
  grid.innerHTML = addons.map(a => `
    <div class="addon-card" id="acard-${a.id}" onclick="toggleAddon('${a.id}')">
      <div class="addon-card__icon">${a.image ? `<img src="${esc(a.image)}" alt="${esc(a.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" onerror="handleAddonImgError(this)">` : ADDON_ICON_SVG}</div>
      <p class="addon-card__name">${esc(a.name)}</p>
      <p class="addon-card__price">&#8377;${a.price} / ${esc(a.unit)}</p>
      <div class="addon-card__qty" id="aqty-${a.id}" style="display:none">
        <button onclick="event.stopPropagation();changeAddonQty('${a.id}',-1)">&#8722;</button>
        <span id="aqtyval-${a.id}">1</span>
        <button onclick="event.stopPropagation();changeAddonQty('${a.id}',1)">+</button>
      </div>
      <div class="addon-card__check" id="acheck-${a.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    </div>`).join('');
  document.getElementById('addonsOverlay').style.display = 'block';
  document.getElementById('addonsModal').classList.add('open');
}

function toggleAddon(id) {
  const card  = document.getElementById('acard-'  + id);
  const check = document.getElementById('acheck-' + id);
  const qtyEl = document.getElementById('aqty-'   + id);
  if (_selectedAddons[id]) {
    delete _selectedAddons[id];
    card.classList.remove('selected');
    check.classList.remove('visible');
    qtyEl.style.display = 'none';
  } else {
    _selectedAddons[id] = 1;
    card.classList.add('selected');
    check.classList.add('visible');
    qtyEl.style.display = 'flex';
  }
}

function changeAddonQty(id, delta) {
  if (!_selectedAddons[id]) return;
  _selectedAddons[id] = Math.max(1, (_selectedAddons[id] || 1) + delta);
  document.getElementById('aqtyval-' + id).textContent = _selectedAddons[id];
}

function closeAddons() {
  document.getElementById('addonsOverlay').style.display = 'none';
  document.getElementById('addonsModal').classList.remove('open');
  _pendingProductId = null;
  _selectedAddons = {};
}

function skipAddons() {
  _commitToCart([]);
  closeAddons();
  openCartDrawer();
}

function confirmAddons() {
  const allAddons = _addonsCache;
  const selected = Object.entries(_selectedAddons).map(([id, qty]) => {
    const a = allAddons.find(x => x.id === id);
    return a ? { ...a, qty } : null;
  }).filter(Boolean);
  _commitToCart(selected);
  closeAddons();
  openCartDrawer();
}

function _commitToCart(addons) {
  const product = getProducts().find(p => p.id === _pendingProductId);
  if (!product) return;
  const qty = _pendingQty || 1;
  const unitPrice = productFinalPrice(product, _pendingVariant);
  const variantLabel = variantSelectionLabel(product, _pendingVariant);
  const addonsTotal = addons.reduce((s, a) => s + a.price * a.qty, 0);
  _cartItems.push({
    cartId: Date.now().toString(36) + Math.random().toString(36).slice(2,4),
    product, qty, addons, unitPrice,
    variantSelection: _pendingVariant,
    variantLabel,
    subtotal: unitPrice * qty + addonsTotal
  });
  _pendingQty = 1;
  updateCartBadge();
  if (typeof krTrackAddToCart === 'function') krTrackAddToCart(product, qty, unitPrice);
}

/* ── CART DRAWER ── */
function updateCartBadge() {
  const total = _cartItems.reduce((s, i) => s + i.qty, 0);
  const badge = document.getElementById('cartBadge');
  const count = document.getElementById('cartCount');
  if (badge) { badge.textContent = total; badge.style.display = total > 0 ? 'flex' : 'none'; }
  if (count) count.textContent = total + ' item' + (total !== 1 ? 's' : '');
}

function openCartDrawer() {
  renderCartDrawer();
  document.getElementById('cartBackdrop').style.display = 'block';
  document.getElementById('cartDrawer').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCartDrawer() {
  document.getElementById('cartBackdrop').style.display = 'none';
  document.getElementById('cartDrawer').classList.remove('open');
  document.body.style.overflow = '';
}

function renderCartDrawer() {
  const list   = document.getElementById('cartItemsList');
  const empty  = document.getElementById('cartEmpty');
  const footer = document.getElementById('cartFooter');
  updateCartBadge();
  if (_cartItems.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'flex';
    footer.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  footer.style.display = 'block';
  list.innerHTML = _cartItems.map((item, idx) => {
    const variantHtml = item.variantLabel ? `<div class="cart-item__variant">${esc(item.variantLabel)}</div>` : '';
    const addonsHtml = item.addons.length ? `
      <div class="cart-item__addons">
        ${item.addons.map(a => `<span class="cart-item__addon-tag">+ ${a.name} &#215;${a.qty} (&#8377;${a.price * a.qty})</span>`).join('')}
      </div>` : '';
    return `
      <div class="cart-item">
        <div class="cart-item__img">${CAT_SVG[item.product.category] || CAT_SVG['birthday-cakes']}</div>
        <div class="cart-item__info">
          <div class="cart-item__name">${esc(item.product.name)}</div>
          ${variantHtml}
          <div class="cart-item__price">&#8377;${item.unitPrice.toLocaleString('en-IN')}</div>
          ${addonsHtml}
        </div>
        <div class="cart-item__actions">
          <div class="cart-item__qty">
            <button onclick="cartChangeQty(${idx},-1)">&#8722;</button>
            <span>${item.qty}</span>
            <button onclick="cartChangeQty(${idx},1)">+</button>
          </div>
          <div class="cart-item__subtotal">&#8377;${item.subtotal.toLocaleString('en-IN')}</div>
          <button class="cart-item__remove" onclick="cartRemove(${idx})" title="Remove">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');
  const grand = _cartItems.reduce((s, i) => s + i.subtotal, 0);
  document.getElementById('cartSubtotal').innerHTML    = '&#8377;' + grand.toLocaleString('en-IN');
  document.getElementById('cartTotalDisplay').innerHTML = '&#8377;' + grand.toLocaleString('en-IN');
}

function cartChangeQty(idx, delta) {
  if (!_cartItems[idx]) return;
  _cartItems[idx].qty = Math.max(1, _cartItems[idx].qty + delta);
  _cartItems[idx].subtotal = _cartItems[idx].unitPrice * _cartItems[idx].qty +
    _cartItems[idx].addons.reduce((s, a) => s + a.price * a.qty, 0);
  renderCartDrawer();
}

function cartRemove(idx) {
  _cartItems.splice(idx, 1);
  renderCartDrawer();
}

function openCartCheckout() {
  if (_cartItems.length === 0) return;
  closeCartDrawer();
  // Build a summary product for the checkout modal
  const summary = {
    id: 'cart',
    name: _cartItems.length === 1 ? _cartItems[0].product.name : `${_cartItems.length} items`,
    category: _cartItems[0].product.category,
    images: _cartItems[0].product.images,
    mrp: _cartItems.reduce((s, i) => s + i.subtotal * i.qty, 0),
    discount: 0,
    prepHours: Math.max(0, ..._cartItems.map(i => i.product.prepHours || 0)),
    _isCart: true,
    _cartItems: _cartItems.slice()
  };
  openCheckout('cart', summary);
}

/* ── GALLERY INIT ── */
function initGalleries() {
  document.querySelectorAll('.pcard__gallery').forEach(gallery => {
    const track  = gallery.querySelector('.pcard__gal-track');
    const slides = track ? [...track.querySelectorAll('.pcard__gal-slide')] : [];
    if (slides.length < 2) return;

    const dots    = [...gallery.querySelectorAll('.pcard__gal-dot')];
    const prevBtn = gallery.querySelector('.pcard__gal-prev');
    const nextBtn = gallery.querySelector('.pcard__gal-next');
    let cur = 0;

    function goTo(idx) {
      cur = (idx + slides.length) % slides.length;
      track.style.transform = `translateX(-${cur * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle('active', i === cur));
    }

    prevBtn?.addEventListener('click', e => { e.preventDefault(); goTo(cur - 1); });
    nextBtn?.addEventListener('click', e => { e.preventDefault(); goTo(cur + 1); });
    dots.forEach((d, i) => d.addEventListener('click', e => { e.preventDefault(); goTo(i); }));

    /* Touch swipe */
    let startX = null;
    track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive:true });
    track.addEventListener('touchend', e => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) dx < 0 ? goTo(cur+1) : goTo(cur-1);
      startX = null;
    }, { passive:true });
  });
}

function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1A1A1A;color:#FAF7F0;padding:12px 24px;border-radius:8px;border:1px solid rgba(201,168,112,0.3);font-size:0.875rem;z-index:9999';
  t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* ── Page-level UI wiring shared by every page that includes this file ──
   (menu tabs, sub-category circles, filter pills, "can't find" forms).
   All are no-ops if the relevant elements aren't present on the page. ── */
function initSharedPageUI() {
  const tabs = document.querySelectorAll('.menu-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', e => {
      const catId = tab.dataset.cat;
      const section = document.getElementById(`cat-${catId}`);
      if (!section) return; // not on this page — let the link navigate normally
      e.preventDefault();
      const offset = (document.getElementById('menuTabs')?.offsetHeight || 0) + 90;
      const top = section.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  const sections = [...document.querySelectorAll('.menu-cat-section')];
  const tabsBar  = document.getElementById('menuTabs');
  if (sections.length && tabsBar) {
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY + tabsBar.offsetHeight + 100;
      let active = sections[0];
      sections.forEach(s => { if (s.offsetTop <= scrollY) active = s; });
      if (active) {
        const catId = active.id.replace('cat-','');
        tabs.forEach(t => t.classList.toggle('active', t.dataset.cat === catId));
      }
    }, { passive: true });
  }

  // Sub-category (flavour) circles and filter pills act on the same grid
  // and combine (AND logic) rather than one resetting the other's state.
  function applySectionFilters(section) {
    const grid = section.querySelector('.pcard-grid');
    if (!grid) return;

    const activeSubcat = section.querySelector('.subcat-item.active');
    const flavourFilter = activeSubcat ? activeSubcat.dataset.filter : null;

    const activePill = section.querySelector('.filter-pill.active');
    const tag   = activePill ? activePill.dataset.pill  : null;
    const price = activePill ? activePill.dataset.price : null;

    grid.querySelectorAll('.pcard').forEach(card => {
      let show = true;

      if (flavourFilter && flavourFilter !== 'all') {
        show = card.dataset.flavour === flavourFilter;
      }
      if (show && tag && tag !== 'all') {
        const tagBadge = card.querySelector('.pcard__tag-badge');
        show = !!(tagBadge && tagBadge.classList.contains(tag));
      }
      if (show && price) {
        const priceEl = card.querySelector('.pcard__price');
        const amt = parseInt((priceEl?.textContent || '').replace(/[^\d]/g, '')) || 0;
        if (price === 'under-500')  show = amt < 500;
        if (price === 'under-1000') show = amt < 1000;
        if (price === 'under-1500') show = amt < 1500;
      }
      card.style.display = show ? '' : 'none';
    });
  }

  document.querySelectorAll('.subcat-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const section = item.closest('.menu-cat-section');
      section.querySelectorAll('.subcat-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      applySectionFilters(section);
    });
  });

  // Deep-link support: ?flavour=<key> (e.g. from the homepage's quick-
  // category circles) pre-selects that flavour filter and scrolls to it,
  // instead of landing on the unfiltered category page.
  const flavourParam = new URLSearchParams(location.search).get('flavour');
  if (flavourParam) {
    const match = document.querySelector(`.subcat-item[data-filter="${CSS.escape(flavourParam.toLowerCase())}"]`);
    if (match) {
      const section = match.closest('.menu-cat-section');
      section.querySelectorAll('.subcat-item').forEach(i => i.classList.remove('active'));
      match.classList.add('active');
      applySectionFilters(section);
      const offset = (document.getElementById('menuTabs')?.offsetHeight || 0) + 90;
      const top = section.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const section = pill.closest('.menu-cat-section');
      section.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      applySectionFilters(section);
    });
  });

  document.querySelectorAll('.cant-find-form').forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = form.querySelector('[type="submit"]');
      btn.textContent = 'Sending…'; btn.disabled = true;

      const category = form.dataset.category || 'Custom Cake';
      const name     = form.querySelector('[data-field="name"]')?.value.trim()    || '';
      const phone    = form.querySelector('[data-field="phone"]')?.value.trim()   || '';
      const message  = form.querySelector('[data-field="message"]')?.value.trim() || '';

      if (!name || !phone) { showToast('Please enter your name and phone number.'); btn.textContent='Get a Quote in Minutes →'; btn.disabled=false; return; }

      // No localStorage fallback here: it never actually reached the admin
      // panel (that reads from the backend, not the customer's own browser
      // storage), so a failed submit was silently "succeeding" for the
      // customer while going nowhere, and leaving their name/phone/message
      // sitting in plaintext in their browser indefinitely for no reason.
      try {
        const res = await fetch(`${BACKEND_URL}/api/messages`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ name, phone, message: `[${category}] ${message}`, eventType: 'other' })
        });
        if (!res.ok) throw new Error('Request failed');
        form.querySelectorAll('input,textarea,button[type=submit]').forEach(el => el.style.display='none');
        form.querySelector('.cant-find-success').style.display = 'flex';
      } catch(_) {
        showToast('Could not send your request. Please call or WhatsApp us instead.');
        btn.textContent = 'Get a Quote in Minutes →'; btn.disabled = false;
      }
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeCheckout(); closeCartDrawer(); closeAddons(); }
  });
}

/* ═══════════════════════════════════════════════════════
   CHECKOUT FLOW
   ═══════════════════════════════════════════════════════ */
/* ── Store coordinates (Hyderabad) ── */
const STORES = [
  { name: 'Lalbazar',    lat: 17.3730, lng: 78.4760 },
  { name: 'Suchitra',    lat: 17.5040, lng: 78.4450 },
  { name: 'Boduppal',    lat: 17.4120, lng: 78.5820 },
  { name: 'Ramantapur',  lat: 17.3980, lng: 78.5470 },
  { name: 'Tukkuguda',   lat: 17.2850, lng: 78.5680 },
];

/* ── Local YYYY-MM-DD (NOT .toISOString(), which converts to UTC and can
   shift the calendar date backward for timezones ahead of UTC like IST). ── */
function _localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ── Haversine distance (km) ── */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── Delivery fee tiers ── */
function deliveryFee(km) {
  if (km <= 3)  return 30;
  if (km <= 6)  return 60;
  if (km <= 10) return 100;
  if (km <= 15) return 150;
  if (km <= 20) return 200;
  return 250;
}

/* ── State ── */
let _chkProduct  = null;
let _chkCart     = { qty: 1, deliveryDate: '', deliveryTime: '', notes: '' };
let _chkCust     = { name: '', phone: '', email: '', address: '' };
let _chkDelivery = { mode: 'delivery', store: null, km: null, fee: 0, lat: null, lng: null };
let _chkCoupon   = { code: '', discount: 0, error: '' };

/* Coupon codes -- flat rupee amount off, only above minOrder. Matches the
   FIRST100 offer already advertised in the site-wide promo bar.
   NOTE: this list is display-only. The backend (backend/routes/checkout.js)
   keeps its own authoritative copy and recomputes the order total server-side
   -- never trust a client-supplied discount/amount for what gets charged. */
const COUPONS = {
  FIRST100: { type: 'flat', off: 100, minOrder: 500, label: 'FIRST100 applied — ₹100 off' },
};

// Returns the discount amount (in rupees) to subtract from subtotal+fee.
function _chkCouponDiscount(subtotal, _fee) {
  if (!_chkCoupon.code) return 0;
  const c = COUPONS[_chkCoupon.code];
  if (!c || subtotal < c.minOrder) return 0;
  return c.off;
}

function _chkApplyCoupon() {
  const input = document.getElementById('chkCouponInput');
  const code = (input?.value || '').trim().toUpperCase();
  const sub = _chkSubtotal();
  const c = COUPONS[code];
  if (!code) { _chkCoupon = { code: '', discount: 0, error: '' }; }
  else if (!c) { _chkCoupon = { code: '', discount: 0, error: 'Invalid coupon code.' }; }
  else if (sub < c.minOrder) { _chkCoupon = { code: '', discount: 0, error: `Add ₹${(c.minOrder - sub).toLocaleString('en-IN')} more to use ${code}.` }; }
  else { _chkCoupon = { code, discount: 0, error: '' }; }
  _chkRenderDelivSection();
}

function _chkCouponHTML() {
  if (_chkCoupon.code) {
    return `
      <div class="chk-coupon-box chk-coupon-box--applied">
        <span>&#10003; ${esc(COUPONS[_chkCoupon.code]?.label || _chkCoupon.code)}</span>
        <button type="button" onclick="_chkRemoveCoupon()">Remove</button>
      </div>`;
  }
  return `
    <div class="chk-coupon-box">
      <input id="chkCouponInput" class="chk-input" placeholder="Coupon code (e.g. FIRST100)" style="text-transform:uppercase;flex:1">
      <button type="button" class="btn btn-outline" onclick="_chkApplyCoupon()">Apply</button>
    </div>
    ${_chkCoupon.error ? `<div class="chk-coupon-error">${esc(_chkCoupon.error)}</div>` : ''}`;
}

function _chkRemoveCoupon() {
  _chkCoupon = { code: '', discount: 0, error: '' };
  _chkRenderDelivSection();
}

/* ── Open / Close ── */
function openCheckout(productId, overrideProduct) {
  _chkProduct = overrideProduct || getProducts().find(p => p.id === productId);
  if (!_chkProduct) return;
  _chkCart     = { qty: 1, deliveryDate: '', deliveryTime: '', notes: '' };
  _chkCust     = { name: '', phone: '', email: '', address: '' };
  _chkDelivery = { mode: 'delivery', store: null, km: null, fee: 0, lat: null, lng: null };
  _chkCoupon   = { code: '', discount: 0, error: '' };
  if (typeof krTrackInitiateCheckout === 'function') {
    const items = _chkProduct._isCart ? _chkProduct._cartItems.map(i => i.product) : [_chkProduct];
    const total = _chkProduct._isCart
      ? _chkProduct._cartItems.reduce((s, i) => s + i.subtotal, 0)
      : productFinalPrice(_chkProduct, null);
    krTrackInitiateCheckout(items, total);
  }
  closeCartDrawer();    // avoid the cart drawer and checkout modal ever being visible at once
  closeAccountModal();  // ditto for the account modal
  document.getElementById('checkoutOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  _acctPrefillCheckout(); // fire-and-forget -- fills Step 2 fields before the user gets there
  _chkRenderStep(1);
}

function closeCheckout() {
  document.getElementById('checkoutOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

/* ── Step indicator ── */
function _chkSetSteps(active) {
  ['chkStep1','chkStep2','chkStep3'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('active', i + 1 === active);
    el.classList.toggle('done',   i + 1 < active);
  });
}

function _chkRenderStep(step) {
  _chkSetSteps(step);
  const body = document.getElementById('checkoutBody');
  if (step === 1) body.innerHTML = _chkStep1();
  if (step === 2) body.innerHTML = _chkStep2();
  if (step === 3) {
    body.innerHTML = _chkStep3();
    const container = document.getElementById('chkTurnstileContainer');
    if (container) renderTurnstile(container).then(id => { _chkTurnstileWidgetId = id; });
  }
}

/* ── Minimum lead time: takes the later of the category-based advance-order
   rule and the product's own prep_hours (rounded up to whole days), so a
   product needing e.g. 48h notice can't be ordered for tomorrow even in a
   category that normally allows same-day. ── */
function _chkMinDate() {
  const p = _chkProduct;
  const advanceCategories = ['wedding-cakes', 'engagement-cakes'];
  const needsAdvance = advanceCategories.includes(p.category);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prepDays = Math.ceil((Number(p.prepHours) || 0) / 24);
  const categoryDays = needsAdvance ? 1 : 0;
  const leadDays = Math.max(prepDays, categoryDays);

  return new Date(today.getTime() + leadDays * 24 * 60 * 60 * 1000);
}

/* ════ STEP 1: Product + Variants + Qty + Date ════ */
function _chkStep1() {
  const p    = _chkProduct;
  const hasVariants = (p.variantGroups || []).length > 0;
  const selection = hasVariants ? (_chkCart.variantSelection || variantDefaultSelection(p)) : null;
  _chkCart.variantSelection = selection;
  const fin  = productFinalPrice(p, selection);
  const mrp  = Number(p.mrp) || 0;
  const disc = Number(p.discount) || 0;
  const img  = (p.images || []).filter(Boolean)[0];
  const emoji = CAT_EMOJI[p.category] || CAT_EMOJI['birthday-cakes'];

  const advanceCategories = ['wedding-cakes', 'engagement-cakes'];
  const needsAdvance = advanceCategories.includes(p.category);
  const isBirthday = p.category === 'birthday-cakes' || p.category === 'half-year-birthday-cakes';

  const minDate = _localDateStr(_chkMinDate());
  const catLabel = p.category === 'wedding-cakes' ? 'wedding' : 'engagement';

  const advanceNotice = needsAdvance ? `
    <div class="chk-info-note" style="margin-top:8px; border-color:rgba(201,168,112,0.4)">
      <strong>24-hour advance order required</strong> for ${catLabel} cakes. Please select a date at least 1 day ahead.
    </div>` : '';

  const prepNotice = (Number(p.prepHours) || 0) > 0 ? `
    <div class="chk-info-note" style="margin-top:8px; border-color:rgba(201,168,112,0.4)">
      <strong>This item needs ${p.prepHours} hour${p.prepHours == 1 ? '' : 's'} notice</strong> to prepare.
    </div>` : '';

  const birthdayNote = isBirthday ? `
    <div class="chk-info-note" style="margin-top:8px">
      Delivery time will depend on the distance from our nearest store to your location.
    </div>` : '';

  const timeField = needsAdvance ? `
    <div class="chk-field-group" style="margin-top:14px">
      <label class="chk-label">Preferred Delivery Time *</label>
      <select class="chk-input" id="chkTime">
        <option value="" ${!_chkCart.deliveryTime ? 'selected' : ''} disabled>Select a time slot</option>
        <option value="09:00–11:00" ${_chkCart.deliveryTime === '09:00–11:00' ? 'selected' : ''}>9:00 AM – 11:00 AM</option>
        <option value="11:00–13:00" ${_chkCart.deliveryTime === '11:00–13:00' ? 'selected' : ''}>11:00 AM – 1:00 PM</option>
        <option value="13:00–15:00" ${_chkCart.deliveryTime === '13:00–15:00' ? 'selected' : ''}>1:00 PM – 3:00 PM</option>
        <option value="15:00–17:00" ${_chkCart.deliveryTime === '15:00–17:00' ? 'selected' : ''}>3:00 PM – 5:00 PM</option>
        <option value="17:00–19:00" ${_chkCart.deliveryTime === '17:00–19:00' ? 'selected' : ''}>5:00 PM – 7:00 PM</option>
        <option value="19:00–21:00" ${_chkCart.deliveryTime === '19:00–21:00' ? 'selected' : ''}>7:00 PM – 9:00 PM</option>
      </select>
    </div>` : '';

  const useCards = CATEGORIES_WITH_VARIANT_CARDS.includes(p.category);
  const variantHtml = hasVariants ? p.variantGroups.map((g, gi) => useCards
    ? renderVariantCards(g.name, g, selection[g.name], '_chkVariantCardClick', gi)
    : `
    <div class="chk-field-group">
      <label class="chk-label">${esc(g.name)}</label>
      <select class="chk-input" onchange="_chkVariantChange('${esc(g.name)}', this.value)">
        ${g.optional ? `<option value="-1" ${selection[g.name] === -1 ? 'selected' : ''}>None</option>` : ''}
        ${g.options.map((o, i) => `<option value="${i}" ${selection[g.name] === i ? 'selected' : ''}>${esc(o.label)} — ₹${(Number(o.price) || 0).toLocaleString('en-IN')}</option>`).join('')}
      </select>
    </div>`).join('') : '';

  return `
    <div class="chk-product-row">
      <div class="chk-product-img">
        ${img
          ? `<img src="${esc(img)}" alt="${esc(p.name)}">`
          : `<div class="chk-product-emoji">${emoji}</div>`}
      </div>
      <div>
        <div class="chk-product-name">${esc(p.name)}</div>
        <div class="chk-product-price" id="chkProductPrice">
          ${disc > 0 ? `<s style="color:var(--text-muted);font-size:0.78rem">&#8377;${(hasVariants ? Math.round(fin / (1 - disc / 100)) : mrp).toLocaleString('en-IN')}</s> ` : ''}
          <strong style="color:var(--gold)">&#8377;${fin.toLocaleString('en-IN')}</strong>
          ${disc > 0 ? `<span class="chk-disc-tag">${disc}% OFF</span>` : ''}
        </div>
      </div>
    </div>

    <div id="chkVariantsWrap">${variantHtml}</div>

    <div class="chk-field-group">
      <label class="chk-label">Quantity</label>
      <div class="chk-qty-ctrl">
        <button type="button" class="chk-qty-btn" onclick="_chkQty(-1)">&#8722;</button>
        <span class="chk-qty-val" id="chkQtyVal">${_chkCart.qty}</span>
        <button type="button" class="chk-qty-btn" onclick="_chkQty(1)">+</button>
        <span class="chk-qty-unit" id="chkQtyUnit">cake</span>
      </div>
    </div>

    <div class="chk-field-group">
      <label class="chk-label">Delivery Date *</label>
      <input type="date" class="chk-input" id="chkDate"
        min="${minDate}" value="${_chkCart.deliveryDate}">
      ${advanceNotice}
      ${prepNotice}
      ${birthdayNote}
    </div>
    ${timeField}

    <div class="chk-field-group">
      <label class="chk-label">Special Instructions <span style="font-weight:400;text-transform:none">(optional)</span></label>
      <textarea class="chk-input" id="chkNotes" rows="3"
        placeholder="Flavour, design, message on cake, allergens…">${esc(_chkCart.notes)}</textarea>
    </div>

    <div class="chk-footer">
      <div></div>
      <button class="btn btn-gold chk-next-btn" onclick="_chkStep1Next()">Next: Your Details →</button>
    </div>`;
}

function _chkVariantChange(groupName, optionIndex) {
  if (!_chkCart.variantSelection) _chkCart.variantSelection = {};
  _chkCart.variantSelection[groupName] = Number(optionIndex);
  const p = _chkProduct;
  const fin = productFinalPrice(p, _chkCart.variantSelection);
  const priceEl = document.getElementById('chkProductPrice');
  if (priceEl) priceEl.innerHTML = `<strong style="color:var(--gold)">&#8377;${fin.toLocaleString('en-IN')}</strong>`;
}

// Card-picker equivalent of _chkVariantChange -- re-renders just the
// #chkVariantsWrap block (not the whole step) so the date/notes fields
// the customer may have already filled in aren't reset.
function _chkVariantCardClick(groupName, optionIndex) {
  if (!_chkCart.variantSelection) _chkCart.variantSelection = {};
  _chkCart.variantSelection[groupName] = Number(optionIndex);
  const p = _chkProduct;
  const fin = productFinalPrice(p, _chkCart.variantSelection);
  const priceEl = document.getElementById('chkProductPrice');
  if (priceEl) priceEl.innerHTML = `<strong style="color:var(--gold)">&#8377;${fin.toLocaleString('en-IN')}</strong>`;
  const wrap = document.getElementById('chkVariantsWrap');
  if (wrap) {
    wrap.innerHTML = p.variantGroups.map((g, gi) =>
      renderVariantCards(g.name, g, _chkCart.variantSelection[g.name], '_chkVariantCardClick', gi)
    ).join('');
  }
}

function _chkQty(delta) {
  _chkCart.qty = Math.max(1, Math.min(99, _chkCart.qty + delta));
  const v = document.getElementById('chkQtyVal');
  const u = document.getElementById('chkQtyUnit');
  if (v) v.textContent = _chkCart.qty;
  if (u) u.textContent = 'cake' + (_chkCart.qty > 1 ? 's' : '');
}

function _chkStep1Next() {
  const date  = document.getElementById('chkDate').value;
  const notes = document.getElementById('chkNotes').value.trim();

  if (!date) { _chkToast('Please select a delivery date.'); return; }

  /* Reject dates before the computed minimum (category rule + prep_hours) */
  const minDate = _chkMinDate();
  if (new Date(date) < minDate) {
    _chkToast('Please select a date that allows enough time for us to prepare this order.');
    return;
  }

  const advanceCategories = ['wedding-cakes', 'engagement-cakes'];
  if (advanceCategories.includes(_chkProduct.category)) {
    const timeEl = document.getElementById('chkTime');
    if (!timeEl || !timeEl.value) { _chkToast('Please select a preferred delivery time.'); return; }
    _chkCart.deliveryTime = timeEl.value;
  }

  _chkCart.deliveryDate = date;
  _chkCart.notes = notes;
  _chkRenderStep(2);
}

/* ════ STEP 2: Customer Details ════ */
function _chkStep2() {
  const c = _chkCust;
  const savedAddressChips = (_custToken && _savedAddresses.length) ? `
    <div class="chk-field-group">
      <label class="chk-label">Saved Addresses</label>
      <div class="chk-saved-addr-chips">
        ${_savedAddresses.map(a => `
          <button type="button" class="chk-saved-addr-chip" onclick="_chkUseSavedAddress('${a.id}')">
            <strong>${esc(a.label)}</strong><span>${esc(a.line)}, ${esc(a.city)}</span>
          </button>`).join('')}
      </div>
    </div>` : '';
  return `
    ${savedAddressChips}
    <div class="chk-field-group">
      <label class="chk-label">Full Name *</label>
      <input type="text" class="chk-input" id="chkName"
        value="${esc(c.name)}" placeholder="Your full name">
    </div>

    <div class="chk-field-row">
      <div class="chk-field-group">
        <label class="chk-label">Phone Number *</label>
        <input type="tel" class="chk-input" id="chkPhone"
          value="${esc(c.phone)}" placeholder="+91 98765 43210">
      </div>
      <div class="chk-field-group">
        <label class="chk-label">Email <span style="font-weight:400;text-transform:none">(optional)</span></label>
        <input type="email" class="chk-input" id="chkEmail"
          value="${esc(c.email)}" placeholder="Order confirmation">
      </div>
    </div>

    <div class="chk-field-group">
      <label class="chk-label">Delivery Address *</label>
      <input type="text" class="chk-input" id="chkAddr"
        value="${esc(c.address)}"
        placeholder="House No., Street, Area, Hyderabad">
    </div>

    <div class="chk-info-note">
      Your address helps us find the nearest Krispie's store for freshest delivery.
    </div>

    <div class="chk-footer">
      <button class="btn btn-outline chk-back-btn" onclick="_chkRenderStep(1)">← Back</button>
      <button class="btn btn-gold chk-next-btn" onclick="_chkStep2Next()">Next: Delivery &amp; Pay →</button>
    </div>`;
}

function _chkUseSavedAddress(id) {
  const a = _savedAddresses.find(x => x.id === id);
  if (!a) return;
  document.getElementById('chkName').value = a.name;
  document.getElementById('chkPhone').value = a.phone;
  document.getElementById('chkAddr').value = `${a.line}, ${a.city}${a.pincode ? ' - ' + a.pincode : ''}`;
}

function _chkStep2Next() {
  const name  = document.getElementById('chkName').value.trim();
  const phone = document.getElementById('chkPhone').value.trim();
  const email = document.getElementById('chkEmail').value.trim();
  const addr  = document.getElementById('chkAddr').value.trim();
  if (!name)  { _chkToast('Please enter your name.'); return; }
  if (!phone) { _chkToast('Please enter your phone number.'); return; }
  if (!addr)  { _chkToast('Please enter your delivery address.'); return; }
  _chkCust = { name, phone, email, address: addr };
  _chkRenderStep(3);
}

/* ════ STEP 3: Delivery & Payment ════ */
function _chkStep3() {
  return `
    <div class="chk-mode-toggle">
      <button class="chk-mode-btn${_chkDelivery.mode !== 'pickup' ? ' active' : ''}"
        onclick="_chkSetMode('delivery')">Home Delivery</button>
      <button class="chk-mode-btn${_chkDelivery.mode === 'pickup' ? ' active' : ''}"
        onclick="_chkSetMode('pickup')">Store Pickup</button>
    </div>
    <div id="chkDelivSection">${_chkDelivSection()}</div>`;
}

function _chkDelivSection() {
  return _chkDelivery.mode === 'pickup' ? _chkPickupHTML() : _chkDeliveryHTML();
}

// The delivery/pickup section re-renders on every mode switch, store pick,
// location detect, and coupon apply/remove -- each of those replaces
// #chkDelivSection's innerHTML, which destroys any Turnstile widget
// mounted inside it. Centralizing "re-render then re-mount" here instead of
// repeating it at every call site.
let _chkTurnstileWidgetId = null;
function _chkRenderDelivSection() {
  document.getElementById('chkDelivSection').innerHTML = _chkDelivSection();
  const container = document.getElementById('chkTurnstileContainer');
  if (container) renderTurnstile(container).then(id => { _chkTurnstileWidgetId = id; });
}

function _chkSubtotal() {
  const p = _chkProduct;
  return productFinalPrice(p, _chkCart.variantSelection) * _chkCart.qty;
}

/* ── Delivery sub-section ── */
function _chkDeliveryHTML() {
  const hasLoc = _chkDelivery.lat !== null;
  const locBtn = hasLoc
    ? `<button class="chk-loc-btn chk-loc-btn--done" onclick="_chkDetectLoc()">Location detected — Re-detect</button>`
    : `<button class="chk-loc-btn" id="chkLocBtn" onclick="_chkDetectLoc()">Detect My Location</button>`;

  let storesHTML = '';
  if (hasLoc) {
    const sorted = STORES.map(s => {
      const km  = haversine(_chkDelivery.lat, _chkDelivery.lng, s.lat, s.lng);
      const fee = deliveryFee(km);
      return { ...s, km, fee };
    }).sort((a, b) => a.km - b.km);

    storesHTML = `
      <div class="chk-stores-label">Nearest stores to you:</div>
      <div class="chk-store-list">
        ${sorted.map((s, i) => `
          <div class="chk-store-card${i===0?' best':''}${_chkDelivery.store===s.name?' selected':''}"
            onclick="_chkSelectStore('${s.name}', ${s.km.toFixed(3)}, ${s.fee})">
            <div class="chk-store-card__name">${i===0?'&#9733; ':''}<strong>${s.name}</strong></div>
            <div class="chk-store-card__dist">${s.km.toFixed(1)} km away</div>
            <div class="chk-store-card__fee">&#8377;${s.fee} delivery</div>
          </div>`).join('')}
      </div>`;
  } else {
    storesHTML = `<div class="chk-loc-hint">Tap "Detect My Location" to see delivery distance &amp; fees from each of our 5 stores, or select a store manually below.</div>
      <div class="chk-stores-label">Or choose a store manually:</div>
      <div class="chk-store-list">
        ${STORES.map(s => `
          <div class="chk-store-card${_chkDelivery.store===s.name?' selected':''}"
            onclick="_chkSelectStore('${s.name}', 0, 60)">
            <div class="chk-store-card__name"><strong>${s.name}</strong></div>
            <div class="chk-store-card__dist">Hyderabad</div>
            <div class="chk-store-card__fee">From &#8377;30</div>
          </div>`).join('')}
      </div>`;
  }

  const sub = _chkSubtotal();
  const fee = _chkDelivery.fee || 0;
  const disc = _chkCouponDiscount(sub, fee);
  const canPay = !!_chkDelivery.store;

  return `
    ${locBtn}
    <div class="chk-loc-status" id="chkLocStatus"></div>
    ${storesHTML}
    ${canPay ? `
      ${_chkCouponHTML()}
      <div class="chk-total-box">
        <div class="chk-total-row"><span>Subtotal (&#215;${_chkCart.qty})</span><span>&#8377;${sub.toLocaleString('en-IN')}</span></div>
        <div class="chk-total-row"><span>Delivery to ${_chkDelivery.store}</span><span>&#8377;${fee}</span></div>
        ${disc > 0 ? `<div class="chk-total-row" style="color:#1a7a3c"><span>Coupon (${_chkCoupon.code})</span><span>&#8722;&#8377;${disc.toLocaleString('en-IN')}</span></div>` : ''}
        <div class="chk-total-row chk-total-row--grand"><span>Total</span><span>&#8377;${(sub + fee - disc).toLocaleString('en-IN')}</span></div>
      </div>
      <div id="chkTurnstileContainer" style="margin:12px 0;"></div>
      <div class="chk-pay-btns">
        <button class="chk-pay-online-btn chk-pay-btn" id="chkPayBtn" onclick="_chkPlaceOrder('online')">Pay Online (Razorpay)</button>
      </div>` : ''}
    <div class="chk-footer" style="margin-top:${canPay?'14':'0'}px">
      <button class="btn btn-outline chk-back-btn" onclick="_chkRenderStep(2)">← Back</button>
      <div></div>
    </div>`;
}

/* ── Pickup sub-section ── */
function _chkPickupHTML() {
  const sub = _chkSubtotal();
  const disc = _chkCouponDiscount(sub, 0);
  const canPay = !!_chkDelivery.store;
  return `
    <div class="chk-stores-label" style="margin-bottom:10px">Choose your pickup store:</div>
    <div class="chk-store-list">
      ${STORES.map(s => `
        <div class="chk-store-card${_chkDelivery.store===s.name?' selected':''}"
          onclick="_chkSelectPickup('${s.name}')">
          <div class="chk-store-card__name"><strong>${s.name}</strong></div>
          <div class="chk-store-card__dist">Hyderabad</div>
          <div class="chk-store-card__fee" style="color:#3aac6e">Free Pickup</div>
        </div>`).join('')}
    </div>
    ${canPay ? `
      ${_chkCouponHTML()}
      <div class="chk-total-box">
        <div class="chk-total-row"><span>Subtotal (&#215;${_chkCart.qty})</span><span>&#8377;${sub.toLocaleString('en-IN')}</span></div>
        <div class="chk-total-row"><span>Pickup from ${_chkDelivery.store}</span><span style="color:#3aac6e">Free</span></div>
        ${disc > 0 ? `<div class="chk-total-row" style="color:#1a7a3c"><span>Coupon (${_chkCoupon.code})</span><span>&#8722;&#8377;${disc.toLocaleString('en-IN')}</span></div>` : ''}
        <div class="chk-total-row chk-total-row--grand"><span>Total</span><span>&#8377;${(sub - disc).toLocaleString('en-IN')}</span></div>
      </div>
      <div id="chkTurnstileContainer" style="margin:12px 0;"></div>
      <div class="chk-pay-btns">
        <button class="chk-pay-online-btn chk-pay-btn" id="chkPayBtn" onclick="_chkPlaceOrder('online')">Pay Online (Razorpay)</button>
      </div>` : ''}
    <div class="chk-footer" style="margin-top:${canPay?'14':'0'}px">
      <button class="btn btn-outline chk-back-btn" onclick="_chkRenderStep(2)">← Back</button>
      <div></div>
    </div>`;
}

/* ── Mode switch ── */
function _chkSetMode(mode) {
  _chkDelivery.mode  = mode;
  _chkDelivery.store = null;
  _chkDelivery.fee   = 0;
  document.querySelectorAll('.chk-mode-btn').forEach((btn, i) => {
    btn.classList.toggle('active', (mode === 'delivery') ? i === 0 : i === 1);
  });
  _chkRenderDelivSection();
}

/* ── Location detection ── */
function _chkDetectLoc() {
  const statusEl = document.getElementById('chkLocStatus');
  const btn      = document.getElementById('chkLocBtn') || document.querySelector('.chk-loc-btn');
  if (statusEl) statusEl.textContent = 'Detecting location…';
  if (btn) { btn.textContent = 'Detecting…'; btn.disabled = true; }

  if (!navigator.geolocation) {
    if (statusEl) statusEl.textContent = 'Geolocation not supported by your browser.';
    if (btn) { btn.textContent = 'Detect My Location'; btn.disabled = false; }
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      _chkDelivery.lat = pos.coords.latitude;
      _chkDelivery.lng = pos.coords.longitude;
      /* auto-select nearest store */
      const nearest = STORES.map(s => {
        const km = haversine(_chkDelivery.lat, _chkDelivery.lng, s.lat, s.lng);
        return { ...s, km, fee: deliveryFee(km) };
      }).sort((a, b) => a.km - b.km)[0];
      _chkDelivery.store = nearest.name;
      _chkDelivery.km    = nearest.km;
      _chkDelivery.fee   = nearest.fee;
      _chkRenderDelivSection();
    },
    err => {
      const msgs = {
        1: 'Location access denied. Please allow location or pick a store manually.',
        2: 'Location unavailable. Please pick a store manually.',
        3: 'Location request timed out. Please pick a store manually.',
      };
      if (statusEl) statusEl.textContent = msgs[err.code] || 'Could not detect location.';
      if (btn) { btn.textContent = 'Retry Location'; btn.disabled = false; }
    },
    { timeout: 8000, maximumAge: 60000 }
  );
}

/* ── Store selection ── */
function _chkSelectStore(name, km, fee) {
  _chkDelivery.store = name;
  _chkDelivery.km    = parseFloat(km);
  _chkDelivery.fee   = fee;
  _chkRenderDelivSection();
}

function _chkSelectPickup(name) {
  _chkDelivery.store = name;
  _chkDelivery.km    = 0;
  _chkDelivery.fee   = 0;
  _chkRenderDelivSection();
  /* keep pickup toggle highlighted */
  document.querySelectorAll('.chk-mode-btn').forEach((b, i) => b.classList.toggle('active', i === 1));
}

/* ════ ORDER PLACEMENT ════ */
function _chkOrderPayload(method) {
  const sub   = _chkSubtotal();
  const disc  = _chkCouponDiscount(sub, _chkDelivery.fee || 0);
  const total = sub + (_chkDelivery.fee || 0) - disc;
  const variantLabel = (_chkProduct.variantGroups || []).length
    ? variantSelectionLabel(_chkProduct, _chkCart.variantSelection) : '';
  const itemLabel = variantLabel ? `${_chkProduct.name} (${variantLabel})` : _chkProduct.name;
  return {
    customer_name:    _chkCust.name,
    customer_phone:   _chkCust.phone,
    customer_email:   _chkCust.email || null,
    items:            `${itemLabel} × ${_chkCart.qty}`,
    quantity:         String(_chkCart.qty),
    amount:           total,
    // The fields below are for the backend to independently recompute the
    // authoritative price from -- the amount above is display-only and is
    // never trusted as-is for what gets charged (see routes/checkout.js).
    product_id:       _chkProduct.id,
    variant_selection: _chkCart.variantSelection || null,
    coupon_code:      _chkCoupon.code || null,
    coupon_discount:  disc,
    platform:         'website',
    outlet:           _chkDelivery.store ? _chkDelivery.store.toLowerCase() : null,
    delivery_mode:    _chkDelivery.mode,
    delivery_fee:     _chkDelivery.fee || 0,
    delivery_address: _chkCust.address,
    delivery_date:    _chkCart.deliveryDate,
    delivery_time:    _chkCart.deliveryTime || null,
    notes:            _chkCart.notes || null,
    payment_method:   method,
    status:           'pending',
    turnstileToken:   getTurnstileToken(_chkTurnstileWidgetId),
  };
}

// Prepaid-only: every order must be paid via Razorpay before it's confirmed,
// so there's no local-storage "fake success" fallback path anymore -- if the
// payment can't go through, the customer needs to know and retry, not see a
// success screen for an order nobody actually paid for.
async function _chkPlaceOrder(method) {
  if (!_chkDelivery.store) { _chkToast('Please select a store first.'); return; }
  await _chkSubmitRazorpay();
}

// Attaches the logged-in customer's session (if any) so the backend can
// link this order to their account -- guests simply get no header.
function _chkAuthHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (_custToken) h['Authorization'] = `Bearer ${_custToken}`;
  return h;
}

/* ── Razorpay ── */
async function _chkSubmitRazorpay() {
  const btn = document.getElementById('chkPayBtn');
  if (btn) { btn.textContent = 'Loading…'; btn.disabled = true; }

  const payload = _chkOrderPayload('online');

  try {
    /* 1. Create Razorpay order on backend */
    const res  = await fetch(`${BACKEND_URL}/api/checkout/initiate`, {
      method: 'POST',
      headers: _chkAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.razorpay_order_id) throw new Error(data.error || 'Payment init failed');

    /* 2. Load Razorpay checkout SDK */
    await _chkLoadScript('https://checkout.razorpay.com/v1/checkout.js');

    /* 3. Open Razorpay dialog */
    const options = {
      key:         data.key_id,
      amount:      data.amount,       /* paise */
      currency:    'INR',
      name:        "Krispie's",
      description: payload.items,
      image:       window.location.origin + '/assets/logo.svg',
      order_id:    data.razorpay_order_id,
      prefill: {
        name:    _chkCust.name,
        contact: _chkCust.phone,
        email:   _chkCust.email || '',
      },
      theme: { color: '#C9A870' },
      handler: async (rzpResp) => {
        /* 4. Verify HMAC-SHA256 signature on backend — MUST succeed before showing success */
        try {
          const verifyRes = await fetch(`${BACKEND_URL}/api/checkout/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              internal_order_id:   data.internal_order_id,
              razorpay_order_id:   rzpResp.razorpay_order_id,
              razorpay_payment_id: rzpResp.razorpay_payment_id,
              razorpay_signature:  rzpResp.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json();
          if (!verifyRes.ok || !verifyData.success) {
            throw new Error(verifyData.error || 'Verification failed');
          }
          /* Only show success after server confirms the signature */
          _chkShowSuccess(data.internal_order_id, payload.amount);
        } catch(verifyErr) {
          /* Payment was captured by Razorpay but our server couldn't verify —
             show a specific message so the customer can contact us with their payment ID */
          console.error('[Razorpay] Verify error:', verifyErr);
          if (btn) { btn.textContent = 'Pay Online (Razorpay)'; btn.disabled = false; }
          _chkToast(
            `Payment received (ID: ${rzpResp.razorpay_payment_id}) but could not be confirmed automatically. ` +
            `Please WhatsApp us this ID and we will confirm your order manually.`
          );
        }
      },
      modal: {
        ondismiss: () => {
          if (btn) { btn.textContent = 'Pay Online (Razorpay)'; btn.disabled = false; }
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();

  } catch (err) {
    console.error('Razorpay error:', err);
    if (btn) { btn.textContent = 'Pay Online (Razorpay)'; btn.disabled = false; }
    // The Turnstile token is single-use and was just spent on this failed
    // attempt (whether it was rejected or /initiate failed for some other
    // reason) -- re-arm the widget so retrying doesn't resend a dead token.
    resetTurnstile(_chkTurnstileWidgetId);
    _chkToast('Payment failed. Please try again or contact us directly.');
  }
}

function _chkLoadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ── Success screen ── */
function _chkShowSuccess(orderId, total) {
  if (typeof krTrackPurchase === 'function') {
    const items = _chkProduct._isCart ? _chkProduct._cartItems.map(i => i.product) : [_chkProduct];
    krTrackPurchase(orderId, total, items);
  }
  _chkSetSteps(4); /* all done */
  const modeLabel = 'Paid Online';

  document.getElementById('checkoutBody').innerHTML = `
    <div class="chk-success">
      <div class="chk-success__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg></div>
      <h3 class="chk-success__title">Order Placed!</h3>
      <p class="chk-success__sub">
        Thank you, <strong>${esc(_chkCust.name)}</strong>! Your order has been received.
      </p>
      <div class="chk-success__details">
        <div class="chk-success__row">
          <span>Order ID</span><strong>${esc(String(orderId))}</strong>
        </div>
        <div class="chk-success__row">
          <span>Item</span><strong>${esc(_chkProduct.name)} &#215; ${_chkCart.qty}</strong>
        </div>
        <div class="chk-success__row">
          <span>Total Amount</span><strong style="color:var(--gold)">&#8377;${Number(total).toLocaleString('en-IN')}</strong>
        </div>
        <div class="chk-success__row">
          <span>Store</span><strong>${esc(_chkDelivery.store)}</strong>
        </div>
        <div class="chk-success__row">
          <span>Delivery Date</span><strong>${_chkCart.deliveryDate}</strong>
        </div>
        ${_chkCart.deliveryTime ? `<div class="chk-success__row">
          <span>Delivery Time</span><strong>${_chkCart.deliveryTime}</strong>
        </div>` : ''}
        <div class="chk-success__row">
          <span>Payment</span><strong>${modeLabel}</strong>
        </div>
      </div>
      <p class="chk-success__note">
        We'll call <strong>${esc(_chkCust.phone)}</strong> to confirm your order shortly.
      </p>
      <button class="btn btn-gold" onclick="closeCheckout()" style="margin-top:18px;width:100%">
        Continue Browsing
      </button>
    </div>`;
}

/* ── Toast helper ── */
function _chkToast(msg) {
  if (typeof showToast === 'function') { showToast(msg); return; }
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1A1A1A;color:#FAF7F0;padding:12px 24px;border-radius:8px;border:1px solid rgba(201,168,112,0.3);font-size:0.875rem;z-index:9999';
  t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* ════════════════════════════════════════════════════════
   CUSTOMER ACCOUNTS
   Signup/login, session token, and order history -- injected via JS on
   every page that loads shop.js rather than duplicated per-page HTML.
════════════════════════════════════════════════════════ */
let _custToken   = localStorage.getItem('krispies_customer_token') || null;
let _custProfile = null;
let _acctOtpEmail = ''; // email the last OTP request was sent to, for the verify step

function _acctInjectUI() {
  if (!document.getElementById('acctModal')) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="acct-overlay" id="acctOverlay" onclick="closeAccountModal()"></div>
      <div class="acct-modal" id="acctModal">
        <button class="acct-modal__close" onclick="closeAccountModal()" aria-label="Close">✕</button>
        <div id="acctModalBody"></div>
      </div>`;
    document.body.appendChild(wrap);
  }
  const cartBtn = document.querySelector('[onclick="openCartDrawer()"]');
  if (cartBtn && cartBtn.parentElement && !document.getElementById('acctNavBtn')) {
    const btn = document.createElement('button');
    btn.id = 'acctNavBtn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'My Account');
    btn.style.cssText = 'background:none;border:none;cursor:pointer;padding:6px 8px;color:var(--gold-dark);display:flex;align-items:center;gap:6px;font-size:0.82rem;font-weight:600;';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    btn.onclick = openAccountModal;
    cartBtn.parentElement.insertBefore(btn, cartBtn);
  }
}

function openAccountModal() {
  _acctInjectUI();
  closeCheckout();
  closeCartDrawer();
  document.getElementById('acctOverlay').classList.add('open');
  document.getElementById('acctModal').classList.add('open');
  document.body.style.overflow = 'hidden';
  if (_custToken) _acctRenderLoggedIn(); else _acctRenderAuthForm('login');
}

function closeAccountModal() {
  document.getElementById('acctOverlay')?.classList.remove('open');
  document.getElementById('acctModal')?.classList.remove('open');
  document.body.style.overflow = '';
}

// Shared by the login/signup form and the OTP-request form below -- only
// one of these is ever shown at a time in the account modal, so one widget
// ID is enough. Re-mounted every time _acctRenderAuthForm replaces the
// modal body, same reasoning as the checkout modal's Turnstile widget.
let _acctTurnstileWidgetId = null;
function _acctMountTurnstile() {
  const container = document.getElementById('acctTurnstileContainer');
  if (container) renderTurnstile(container).then(id => { _acctTurnstileWidgetId = id; });
}

function _acctRenderAuthForm(mode) {
  const body = document.getElementById('acctModalBody');

  if (mode === 'otp-request') {
    body.innerHTML = `
      <h3 style="font-family:var(--font-display);margin-bottom:16px;">Log In with Email</h3>
      <div id="acctError" class="acct-error"></div>
      <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:14px;line-height:1.5;">We'll email you a 6-digit code — no password needed. New here? This creates your account too.</p>
      <div class="chk-field-group"><label class="chk-label">Email *</label><input class="chk-input" id="acctOtpEmail" placeholder="you@example.com" type="email" value="${esc(_acctOtpEmail)}"></div>
      <div id="acctTurnstileContainer" style="margin:12px 0;"></div>
      <button class="btn btn-gold" style="width:100%;margin-top:6px;" id="acctOtpSendBtn" onclick="_acctSubmitOtpRequest()">Send Code</button>
      <button class="btn btn-outline" style="width:100%;margin-top:8px;" onclick="_acctRenderAuthForm('login')">← Back to password login</button>`;
    _acctMountTurnstile();
    return;
  }

  if (mode === 'otp-verify') {
    body.innerHTML = `
      <h3 style="font-family:var(--font-display);margin-bottom:16px;">Enter Your Code</h3>
      <div id="acctError" class="acct-error"></div>
      <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:14px;">We sent a 6-digit code to <strong>${esc(_acctOtpEmail)}</strong>. It expires in 10 minutes.</p>
      <div class="chk-field-group"><label class="chk-label">6-Digit Code *</label><input class="chk-input" id="acctOtpCode" placeholder="123456" inputmode="numeric" maxlength="6"></div>
      <div class="chk-field-group"><label class="chk-label">Name <span style="font-weight:400;text-transform:none">(only needed for new accounts)</span></label><input class="chk-input" id="acctOtpName" placeholder="Your name"></div>
      <button class="btn btn-gold" style="width:100%;margin-top:6px;" id="acctOtpVerifyBtn" onclick="_acctSubmitOtpVerify()">Verify &amp; Log In</button>
      <button class="btn btn-outline" style="width:100%;margin-top:8px;" onclick="_acctRenderAuthForm('otp-request')">← Use a different email</button>`;
    return;
  }

  const isLogin = mode === 'login';
  body.innerHTML = `
    <h3 style="font-family:var(--font-display);margin-bottom:16px;">${isLogin ? 'Log In' : 'Create Your Account'}</h3>
    <div class="acct-tabs">
      <button class="acct-tab${isLogin ? ' active' : ''}" onclick="_acctRenderAuthForm('login')">Log In</button>
      <button class="acct-tab${!isLogin ? ' active' : ''}" onclick="_acctRenderAuthForm('signup')">Sign Up</button>
    </div>
    <div id="acctError" class="acct-error"></div>
    ${!isLogin ? `<div class="chk-field-group"><label class="chk-label">Full Name *</label><input class="chk-input" id="acctName" placeholder="Your name"></div>` : ''}
    <div class="chk-field-group"><label class="chk-label">Phone Number *</label><input class="chk-input" id="acctPhone" placeholder="10-digit mobile number" type="tel"></div>
    ${!isLogin ? `<div class="chk-field-group"><label class="chk-label">Email <span style="font-weight:400;text-transform:none">(optional)</span></label><input class="chk-input" id="acctEmail" placeholder="you@example.com" type="email"></div>` : ''}
    <div class="chk-field-group"><label class="chk-label">Password *</label><input class="chk-input" id="acctPassword" placeholder="At least 6 characters" type="password"></div>
    <div id="acctTurnstileContainer" style="margin:12px 0;"></div>
    <button class="btn btn-gold" style="width:100%;margin-top:6px;" onclick="${isLogin ? '_acctSubmitLogin()' : '_acctSubmitSignup()'}">${isLogin ? 'Log In' : 'Create Account'}</button>
    ${isLogin ? `<button class="btn btn-outline" style="width:100%;margin-top:8px;" onclick="_acctRenderAuthForm('otp-request')">Log in with email code instead</button>` : ''}`;
  _acctMountTurnstile();
}

async function _acctSubmitSignup() {
  const name     = document.getElementById('acctName').value.trim();
  const phone    = document.getElementById('acctPhone').value.trim();
  const email    = document.getElementById('acctEmail').value.trim();
  const password = document.getElementById('acctPassword').value;
  const errEl    = document.getElementById('acctError');
  errEl.textContent = '';
  if (!name || !phone || !password) { errEl.textContent = 'Name, phone, and password are required.'; return; }
  try {
    const res = await fetch(`${BACKEND_URL}/api/customers/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email: email || null, password, turnstileToken: getTurnstileToken(_acctTurnstileWidgetId) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || (data.errors && data.errors[0]?.msg) || 'Signup failed.');
    _custToken = data.token; _custProfile = data.customer;
    localStorage.setItem('krispies_customer_token', _custToken);
    _acctRenderLoggedIn();
  } catch (e) {
    errEl.textContent = e.message;
    resetTurnstile(_acctTurnstileWidgetId);
  }
}

async function _acctSubmitLogin() {
  const phone    = document.getElementById('acctPhone').value.trim();
  const password = document.getElementById('acctPassword').value;
  const errEl    = document.getElementById('acctError');
  errEl.textContent = '';
  if (!phone || !password) { errEl.textContent = 'Phone and password are required.'; return; }
  try {
    const res = await fetch(`${BACKEND_URL}/api/customers/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password, turnstileToken: getTurnstileToken(_acctTurnstileWidgetId) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed.');
    _custToken = data.token; _custProfile = data.customer;
    localStorage.setItem('krispies_customer_token', _custToken);
    _acctRenderLoggedIn();
  } catch (e) {
    errEl.textContent = e.message;
    resetTurnstile(_acctTurnstileWidgetId);
  }
}

async function _acctSubmitOtpRequest() {
  const email = document.getElementById('acctOtpEmail').value.trim();
  const errEl = document.getElementById('acctError');
  errEl.textContent = '';
  if (!email) { errEl.textContent = 'Please enter your email.'; return; }
  const btn = document.getElementById('acctOtpSendBtn');
  if (btn) { btn.textContent = 'Sending…'; btn.disabled = true; }
  try {
    const res = await fetch(`${BACKEND_URL}/api/customers/otp/request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, turnstileToken: getTurnstileToken(_acctTurnstileWidgetId) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || (data.errors && data.errors[0]?.msg) || 'Could not send code.');
    _acctOtpEmail = email;
    _acctRenderAuthForm('otp-verify');
  } catch (e) {
    errEl.textContent = e.message;
    if (btn) { btn.textContent = 'Send Code'; btn.disabled = false; }
    resetTurnstile(_acctTurnstileWidgetId);
  }
}

async function _acctSubmitOtpVerify() {
  const otp  = document.getElementById('acctOtpCode').value.trim();
  const name = document.getElementById('acctOtpName').value.trim();
  const errEl = document.getElementById('acctError');
  errEl.textContent = '';
  if (!/^\d{6}$/.test(otp)) { errEl.textContent = 'Enter the 6-digit code from your email.'; return; }
  const btn = document.getElementById('acctOtpVerifyBtn');
  if (btn) { btn.textContent = 'Verifying…'; btn.disabled = true; }
  try {
    const res = await fetch(`${BACKEND_URL}/api/customers/otp/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: _acctOtpEmail, otp, name: name || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || (data.errors && data.errors[0]?.msg) || 'Verification failed.');
    _custToken = data.token; _custProfile = data.customer;
    localStorage.setItem('krispies_customer_token', _custToken);
    _acctRenderLoggedIn();
  } catch (e) {
    errEl.textContent = e.message;
    if (btn) { btn.textContent = 'Verify & Log In'; btn.disabled = false; }
  }
}

function _acctLogout() {
  _custToken = null; _custProfile = null;
  localStorage.removeItem('krispies_customer_token');
  _acctRenderAuthForm('login');
}

const ORDER_STATUS_COLOR = { pending: '#9A7A48', confirmed: '#1a7a3c', ready: '#1e5f85', delivered: '#1a7a3c', cancelled: '#9A4A3A' };
let _acctTab = 'orders'; // 'orders' | 'addresses'
let _savedAddresses = [];

async function loadSavedAddresses() {
  if (!_custToken) { _savedAddresses = []; return; }
  try {
    const res = await fetch(`${BACKEND_URL}/api/customers/addresses`, { headers: { Authorization: `Bearer ${_custToken}` } });
    _savedAddresses = res.ok ? await res.json() : [];
  } catch (_) { _savedAddresses = []; }
}

async function _acctRenderLoggedIn() {
  const body = document.getElementById('acctModalBody');
  body.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:24px 0;">Loading your account…</p>`;
  try {
    if (!_custProfile) {
      const meRes = await fetch(`${BACKEND_URL}/api/customers/me`, { headers: { Authorization: `Bearer ${_custToken}` } });
      if (!meRes.ok) throw new Error('session-expired');
      _custProfile = await meRes.json();
    }
    await loadSavedAddresses();
    body.innerHTML = `
      <div class="acct-profile-hd">
        <div><strong>${esc(_custProfile.name)}</strong><br><span style="color:var(--text-muted);font-size:0.8rem">${esc(_custProfile.phone || _custProfile.email || '')}</span></div>
        <button class="btn btn-outline btn-sm" onclick="_acctLogout()">Log Out</button>
      </div>
      <div class="acct-tabs" style="margin-top:16px">
        <button class="acct-tab${_acctTab === 'orders' ? ' active' : ''}" onclick="_acctSwitchTab(this,'orders')">My Orders</button>
        <button class="acct-tab${_acctTab === 'addresses' ? ' active' : ''}" onclick="_acctSwitchTab(this,'addresses')">Address Book</button>
      </div>
      <div id="acctTabBody"></div>`;
    _acctRenderTabBody();
  } catch (e) {
    _acctLogout();
  }
}

function _acctSwitchTab(btn, tab) {
  _acctTab = tab;
  document.querySelectorAll('#acctModalBody .acct-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  _acctRenderTabBody();
}

async function _acctRenderTabBody() {
  const el = document.getElementById('acctTabBody');
  if (!el) return;
  if (_acctTab === 'addresses') { _acctRenderAddresses(); return; }

  el.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:16px 0;">Loading…</p>`;
  const ordersRes = await fetch(`${BACKEND_URL}/api/customers/orders`, { headers: { Authorization: `Bearer ${_custToken}` } });
  const orders = ordersRes.ok ? await ordersRes.json() : [];
  el.innerHTML = orders.length ? orders.map(o => `
    <div class="acct-order-card">
      <div class="acct-order-card__row">
        <strong>${esc(o.items)}</strong>
        <span class="acct-order-status" style="color:${ORDER_STATUS_COLOR[o.status] || '#9A7A48'}">${esc(o.status)}</span>
      </div>
      <div class="acct-order-card__meta">Order #${esc(o.id)} · ₹${o.amount != null ? Number(o.amount).toLocaleString('en-IN') : '—'} · ${esc(o.order_date || '')}</div>
    </div>`).join('') : `<p style="color:var(--text-muted);font-size:0.85rem">No orders yet — your order history will show up here.</p>`;
}

function _acctRenderAddresses(editId) {
  const el = document.getElementById('acctTabBody');
  if (!el) return;
  const isNew = editId === 'new';
  const isRealEdit = editId != null && !isNew;
  const showForm = isNew || isRealEdit;
  const a = isRealEdit ? _savedAddresses.find(x => x.id === editId) : null;

  const formHTML = showForm ? `
    <div class="acct-address-form">
      <div class="chk-field-group"><label class="chk-label">Label</label><input class="chk-input" id="addrLabel" value="${esc(a?.label || 'Home')}" placeholder="Home / Work / Other"></div>
      <div class="chk-field-group"><label class="chk-label">Full Name *</label><input class="chk-input" id="addrName" value="${esc(a?.name || _custProfile.name || '')}"></div>
      <div class="chk-field-group"><label class="chk-label">Phone *</label><input class="chk-input" id="addrPhone" value="${esc(a?.phone || _custProfile.phone || '')}"></div>
      <div class="chk-field-group"><label class="chk-label">Address *</label><input class="chk-input" id="addrLine" value="${esc(a?.line || '')}" placeholder="House No., Street, Area"></div>
      <div class="chk-field-row">
        <div class="chk-field-group"><label class="chk-label">City</label><input class="chk-input" id="addrCity" value="${esc(a?.city || 'Hyderabad')}"></div>
        <div class="chk-field-group"><label class="chk-label">Pincode</label><input class="chk-input" id="addrPincode" value="${esc(a?.pincode || '')}"></div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;font-size:0.82rem;color:var(--text-muted);margin:4px 0 12px;">
        <input type="checkbox" id="addrDefault" ${a?.isDefault ? 'checked' : ''}> Set as default address
      </label>
      <div id="addrError" class="acct-error"></div>
      <div style="display:flex;gap:10px;">
        <button class="btn btn-outline" style="flex:1" onclick="_acctRenderAddresses()">Cancel</button>
        <button class="btn btn-gold" style="flex:1" onclick="_acctSaveAddress(${isRealEdit ? `'${editId}'` : 'null'})">Save Address</button>
      </div>
    </div>` : '';

  el.innerHTML = `
    ${_savedAddresses.map(addr => `
      <div class="acct-address-card${addr.isDefault ? ' is-default' : ''}">
        <div class="acct-address-card__hd">
          <strong>${esc(addr.label)}</strong>
          ${addr.isDefault ? '<span class="acct-address-default-badge">Default</span>' : ''}
        </div>
        <div class="acct-address-card__body">${esc(addr.name)} · ${esc(addr.phone)}<br>${esc(addr.line)}, ${esc(addr.city)}${addr.pincode ? ' – ' + esc(addr.pincode) : ''}</div>
        <div class="acct-address-card__actions">
          <button class="btn-link" onclick="_acctRenderAddresses('${addr.id}')">Edit</button>
          <button class="btn-link btn-link--danger" onclick="_acctDeleteAddress('${addr.id}')">Delete</button>
        </div>
      </div>`).join('')}
    ${!_savedAddresses.length && !showForm ? `<p style="color:var(--text-muted);font-size:0.85rem">No saved addresses yet.</p>` : ''}
    ${formHTML}
    ${!showForm ? `<button class="btn btn-outline" style="width:100%;margin-top:8px;" onclick="_acctRenderAddresses('new')">+ Add New Address</button>` : ''}`;
}

async function _acctSaveAddress(id) {
  const errEl = document.getElementById('addrError');
  const body = {
    label: document.getElementById('addrLabel').value.trim() || 'Home',
    name: document.getElementById('addrName').value.trim(),
    phone: document.getElementById('addrPhone').value.trim(),
    line: document.getElementById('addrLine').value.trim(),
    city: document.getElementById('addrCity').value.trim() || 'Hyderabad',
    pincode: document.getElementById('addrPincode').value.trim(),
    isDefault: document.getElementById('addrDefault').checked,
  };
  if (!body.name || !body.phone || !body.line) { errEl.textContent = 'Name, phone, and address are required.'; return; }
  try {
    const url = id ? `${BACKEND_URL}/api/customers/addresses/${id}` : `${BACKEND_URL}/api/customers/addresses`;
    const res = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_custToken}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || (data.errors && data.errors[0]?.msg) || 'Failed to save address.');
    await loadSavedAddresses();
    _acctRenderAddresses();
  } catch (e) { errEl.textContent = e.message; }
}

async function _acctDeleteAddress(id) {
  if (!confirm('Delete this address?')) return;
  try {
    await fetch(`${BACKEND_URL}/api/customers/addresses/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${_custToken}` } });
    await loadSavedAddresses();
    _acctRenderAddresses();
  } catch (_) {}
}

// Pre-fill checkout's customer-details step from a logged-in profile, and
// let _chkOrderPayload/COD/Razorpay submit calls attach the auth header.
async function _acctPrefillCheckout() {
  if (!_custToken) return;
  try {
    if (!_custProfile) {
      const res = await fetch(`${BACKEND_URL}/api/customers/me`, { headers: { Authorization: `Bearer ${_custToken}` } });
      if (!res.ok) throw new Error('expired');
      _custProfile = await res.json();
    }
    _chkCust.name  = _chkCust.name  || _custProfile.name  || '';
    _chkCust.phone = _chkCust.phone || _custProfile.phone || '';
    _chkCust.email = _chkCust.email || _custProfile.email || '';
    await loadSavedAddresses();
    const def = _savedAddresses.find(a => a.isDefault);
    if (def && !_chkCust.address) _chkCust.address = `${def.line}, ${def.city}${def.pincode ? ' - ' + def.pincode : ''}`;
  } catch (_) { _acctLogout(); }
}

/* ── Boot: load products from backend, render, wire up page UI ──
   Dispatches 'shop:ready' once products have loaded, for pages like
   product-page.html that need to look up a single product before rendering. */
(async function initShop() {
  await Promise.all([loadProducts(), loadAddons()]);
  renderAll();
  renderFeatured();
  renderTrending();
  renderSubcatCircles();
  initSharedPageUI();
  _acctInjectUI();
  document.dispatchEvent(new CustomEvent('shop:ready'));
})();
