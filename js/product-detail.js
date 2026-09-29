/* ════════════════════════════════════════════════════════════════════════
   Krispie's — product-page.html detail page logic.
   Requires js/shop.js to already be loaded (uses getProducts, esc,
   productFinalPrice, addToCart, openCheckout, CAT_SVG).
   ════════════════════════════════════════════════════════════════════════ */

let _pdpProduct = null;
let _pdpSelection = null;
let _pdpGalleryIndex = 0;

function _pdpSlugFromUrl() {
  const pathMatch = window.location.pathname.match(/\/products?\/([^/?#]+)/);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);
  const params = new URLSearchParams(window.location.search);
  return params.get('slug') || params.get('id') || '';
}

function _pdpRender() {
  const p = _pdpProduct;
  const container = document.getElementById('pdpContainer');
  const imgs = (p.images || []).filter(Boolean);
  const hasImgs = imgs.length > 0;
  const emoji = CAT_EMOJI[p.category] || CAT_EMOJI['birthday-cakes'];
  const hasVariants = (p.variantGroups || []).length > 0;
  if (!_pdpSelection) _pdpSelection = variantDefaultSelection(p);

  const tagColours = { bestseller:'#9A4A3A', new:'#1a7a3c', seasonal:'#1e5f85', custom:'#7b3f9e' };
  const tagHtml = p.tag ? `<span class="pdp__tag" style="background:${tagColours[p.tag]||'#9A4A3A'}">${TAG_LABELS[p.tag] || p.tag}</span>` : '';
  // Same-day trust badge, data-driven off prepHours rather than hardcoded
  // to one category -- true for any product that needs no advance notice,
  // not just rakhi. Products that DO need notice already get that called
  // out via prepNote below, so this only shows when it's a genuine claim.
  const badgeHtml = (Number(p.prepHours) || 0) === 0
    ? `<div class="pdp__badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>Same-Day Delivery Available</div>`
    : '';

  const mainImg = hasImgs ? imgs[_pdpGalleryIndex] || imgs[0] : null;
  const galleryHtml = `
    <div class="pdp__gallery-wrap">
      <button class="pdp__gallery-wish${_pdpGetWishlist().includes(p.id) ? ' pdp__gallery-wish--active' : ''}" id="pdpWishlistBtn" onclick="_pdpToggleWishlist()" title="Save to wishlist" aria-label="Add to wishlist">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="${_pdpGetWishlist().includes(p.id) ? '#e74c3c' : 'none'}" stroke="${_pdpGetWishlist().includes(p.id) ? '#e74c3c' : '#888'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
      </button>
      <div class="pdp__gallery">
        ${mainImg
          ? `<img src="${esc(mainImg)}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover;display:block;">`
          : `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#fdf0ec 0%,#f5e6e0 100%);">
               <div style="width:64px;height:64px;color:var(--gold-dark)">${emoji}</div>
               <div style="font-size:0.78rem;color:#b08070;margin-top:10px;font-weight:500;">Photo coming soon</div>
             </div>`}
      </div>
    </div>
    ${imgs.length > 1 ? `
      <div class="pdp__thumbs">
        ${imgs.map((url, i) => `
          <div class="pdp__thumb${i === _pdpGalleryIndex ? ' active' : ''}" onclick="_pdpSetGalleryIndex(${i})">
            <img src="${esc(url)}" alt="${esc(p.name)} ${i+1}">
          </div>`).join('')}
      </div>` : ''}
  `;

  const useVariantCards = CATEGORIES_WITH_VARIANT_CARDS.includes(p.category);
  const variantHtml = hasVariants ? p.variantGroups.map((g, gi) => useVariantCards
    ? renderVariantCards(g.name, g, _pdpSelection[g.name], '_pdpVariantCardClick', gi)
    : `
    <div class="chk-field-group">
      <label class="chk-label">${esc(g.name)}</label>
      <select class="chk-input" onchange="_pdpVariantChange('${esc(g.name)}', this.value)">
        ${g.optional ? `<option value="-1" ${_pdpSelection[g.name] === -1 ? 'selected' : ''}>None</option>` : ''}
        ${g.options.map((o, i) => `<option value="${i}" ${_pdpSelection[g.name] === i ? 'selected' : ''}>${esc(o.label)} — ₹${(Number(o.price) || 0).toLocaleString('en-IN')}</option>`).join('')}
      </select>
    </div>`).join('') : '';

  const prepNote = (Number(p.prepHours) || 0) > 0
    ? `<div class="chk-info-note pdp__prep-note"><strong>This item needs ${p.prepHours} hour${p.prepHours == 1 ? '' : 's'} notice</strong> to prepare.</div>`
    : '';

  container.innerHTML = `
    <div class="pdp__breadcrumb">
      <a href="menu">Menu</a> / <a href="${esc(p.category)}">${esc((p.category || '').replace(/-/g,' ').replace(/\b\w/g, c => c.toUpperCase()))}</a> / ${esc(p.name)}
    </div>
    <div class="pdp__grid">
      <div class="pdp__gallery-col">${galleryHtml}</div>
      <div>
        ${badgeHtml}
        ${tagHtml}
        <h1 class="pdp__title">${esc(p.name)}</h1>
        ${p.ratingCount > 0 ? `
          <div class="pdp__rating">
            <span class="pdp__rating-stars">${'★'.repeat(Math.round(p.ratingAvg))}${'☆'.repeat(5 - Math.round(p.ratingAvg))}</span>
            <span class="pdp__rating-value">${p.ratingAvg}</span>
            <a href="#pdpRatingsSection" class="pdp__rating-count">(${p.ratingCount} rating${p.ratingCount === 1 ? '' : 's'})</a>
          </div>` : ''}
        <p class="pdp__desc">${esc(p.description)}</p>
        <div class="pdp__price-row" id="pdpPriceRow"></div>

        ${variantHtml}

        <div class="chk-field-group">
          <label class="chk-label">Quantity</label>
          <div class="chk-qty-ctrl">
            <button type="button" class="chk-qty-btn" onclick="_pdpQty(-1)">&#8722;</button>
            <span class="chk-qty-val" id="pdpQtyVal">1</span>
            <button type="button" class="chk-qty-btn" onclick="_pdpQty(1)">+</button>
            <span class="chk-qty-unit">cake${_pdpQtyValue > 1 ? 's' : ''}</span>
          </div>
        </div>
        ${prepNote}

        <div class="pdp__actions">
          <button class="btn btn-gold pdp__atc-btn" onclick="_pdpAddToCart()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;vertical-align:middle;flex-shrink:0"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/></svg>
            Add to Cart
          </button>
        </div>

        <!-- Pincode delivery check -->
        <div class="pdp__pincode-check">
          <div class="pdp__pincode-row">
            <input id="pdpPincodeInput" class="pdp__pincode-input" placeholder="Enter pincode to check delivery" maxlength="6" inputmode="numeric" onkeydown="if(event.key==='Enter')_pdpCheckPincode()">
            <button class="pdp__pincode-btn" onclick="_pdpCheckPincode()">Check</button>
          </div>
          <div id="pdpPincodeResult" class="pdp__pincode-result"></div>
        </div>

        <!-- Payment modes — official brand logos -->
        <div class="pdp__pay-modes">
          <span class="pdp__pay-label">We accept:</span>
          <!-- UPI -->
          <svg class="pdp__pay-logo" viewBox="0 0 58 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="58" height="36" rx="5" fill="#fff" stroke="#dde"/>
            <text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="13" fill="#5C0099" letter-spacing="1">UPI</text>
            <rect x="8" y="26" width="14" height="3" rx="1.5" fill="#097939"/>
            <rect x="24" y="26" width="14" height="3" rx="1.5" fill="#FF6600"/>
          </svg>
          <!-- Visa -->
          <svg class="pdp__pay-logo" viewBox="0 0 58 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="58" height="36" rx="5" fill="#fff" stroke="#dde"/>
            <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="17" fill="#1A1F71" font-style="italic" letter-spacing="1">VISA</text>
          </svg>
          <!-- Mastercard -->
          <svg class="pdp__pay-logo" viewBox="0 0 58 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="58" height="36" rx="5" fill="#fff" stroke="#dde"/>
            <circle cx="23" cy="18" r="9" fill="#EB001B"/>
            <circle cx="35" cy="18" r="9" fill="#F79E1B"/>
            <path d="M29 10.9a9 9 0 010 14.2 9 9 0 010-14.2z" fill="#FF5F00"/>
          </svg>
          <!-- RuPay -->
          <svg class="pdp__pay-logo" viewBox="0 0 58 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="58" height="36" rx="5" fill="#fff" stroke="#dde"/>
            <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="11" fill="#007DC1">Ru</text>
            <text x="50%" y="78%" dominant-baseline="middle" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="11" fill="#008C44">Pay</text>
          </svg>
          <!-- Razorpay -->
          <svg class="pdp__pay-logo" viewBox="0 0 58 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="58" height="36" rx="5" fill="#fff" stroke="#dde"/>
            <polygon points="22,26 29,10 36,26 31,26 29,20 27,26" fill="#2C85ED"/>
            <polygon points="29,20 31,26 27,26" fill="#3395FF" opacity="0.5"/>
          </svg>
        </div>

        <!-- Share buttons -->
        <div class="pdp__social-row">
          <button class="pdp__share-btn" onclick="_pdpShareWA()" title="Share on WhatsApp">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.122 1.522 5.855L.057 23.885l6.177-1.438A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.986 0-3.848-.574-5.42-1.565l-.388-.231-4.022.937.989-3.925-.253-.4A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            Share
          </button>
          <button class="pdp__share-btn" onclick="_pdpCopyLink()" title="Copy link">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            Copy Link
          </button>
        </div>
      </div>
    </div>`;
  _pdpUpdatePriceDisplay();
  _pdpUpdateWishlist();
}

let _pdpQtyValue = 1;

// Single source of truth for the price row -- shows qty x unit price as
// the headline number, with the per-unit price called out once qty > 1
// so it's clear the total is being multiplied.
function _pdpUpdatePriceDisplay() {
  const p = _pdpProduct;
  const hasVariants = (p.variantGroups || []).length > 0;
  const mrp = Number(p.mrp) || 0;
  const discount = Number(p.discount) || 0;
  const unitPrice = productFinalPrice(p, _pdpSelection);
  const total = unitPrice * _pdpQtyValue;
  const row = document.getElementById('pdpPriceRow');
  if (!row) return;
  // For a variant product there's no single mrp to multiply -- reverse the
  // uniform discount off the (already-discounted) unit price instead, same
  // approach as the checkout modal and menu cards.
  const wasUnit = hasVariants ? Math.round(unitPrice / (1 - discount / 100)) : mrp;
  row.innerHTML = `
    <span class="pdp__price">₹${total.toLocaleString('en-IN')}</span>
    ${_pdpQtyValue > 1 ? `<span class="pdp__per-unit">(₹${unitPrice.toLocaleString('en-IN')} each)</span>` : ''}
    ${discount > 0 ? `<span class="pdp__mrp">₹${(wasUnit * _pdpQtyValue).toLocaleString('en-IN')}</span>` : ''}
    ${discount > 0 ? `<span class="pdp__discount">${discount}% OFF</span>` : ''}
  `;
}

function _pdpSetGalleryIndex(i) {
  _pdpGalleryIndex = i;
  _pdpRender();
}

function _pdpVariantChange(groupName, optionIndex) {
  _pdpSelection[groupName] = Number(optionIndex);
  _pdpUpdatePriceDisplay();
}

// Card-picker equivalent -- a full _pdpRender() (not just a price update)
// so the clicked card's "selected" border shows immediately. Safe to
// re-render the whole panel here: quantity lives in the module-level
// _pdpQtyValue, not in the DOM, so it survives the rebuild.
function _pdpVariantCardClick(groupName, optionIndex) {
  _pdpSelection[groupName] = Number(optionIndex);
  _pdpRender();
}

function _pdpQty(delta) {
  _pdpQtyValue = Math.max(1, Math.min(99, _pdpQtyValue + delta));
  const el = document.getElementById('pdpQtyVal');
  if (el) el.textContent = _pdpQtyValue;
  _pdpUpdatePriceDisplay();
}

function _pdpAddToCart() {
  addToCart(_pdpProduct.id, _pdpProduct.variantGroups?.length ? _pdpSelection : null, _pdpQtyValue);
}

/* ── Pincode delivery check ── */
async function _pdpCheckPincode() {
  const input = document.getElementById('pdpPincodeInput');
  const result = document.getElementById('pdpPincodeResult');
  const pin = (input?.value || '').trim().replace(/\D/g, '');
  if (pin.length !== 6) { if (result) result.textContent = 'Enter a valid 6-digit pincode.'; return; }
  if (result) result.innerHTML = '<span style="color:#888">Checking…</span>';
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${pin}&country=India&format=json&limit=1`, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'KrispiesWebsite/1.0' }
    });
    const data = await res.json();
    if (!data.length) { if (result) result.textContent = 'Pincode not found. Try a nearby pincode.'; return; }
    const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
    const nearest = STORES.map(s => {
      const km = haversine(lat, lng, s.lat, s.lng);
      return { ...s, km, fee: deliveryFee(km) };
    }).sort((a, b) => a.km - b.km)[0];
    if (nearest.km > 30) {
      if (result) result.innerHTML = `<span style="color:#c0392b">Outside our delivery range. Please call us to check.</span>`;
    } else {
      if (result) result.innerHTML = `<span class="pdp__pincode-ok">✓ Delivery available — <strong>₹${nearest.fee}</strong> from ${nearest.name} store (${nearest.km.toFixed(1)} km)</span>`;
    }
  } catch (_) {
    if (result) result.textContent = 'Could not check. Try again or call us.';
  }
}

/* ── Wishlist ── */
function _pdpGetWishlist() {
  try { return JSON.parse(localStorage.getItem('krispies_wishlist') || '[]'); } catch (_) { return []; }
}
function _pdpToggleWishlist() {
  const id = _pdpProduct?.id;
  if (!id) return;
  let list = _pdpGetWishlist();
  if (list.includes(id)) { list = list.filter(x => x !== id); } else { list.push(id); }
  try { localStorage.setItem('krispies_wishlist', JSON.stringify(list)); } catch (_) {}
  _pdpUpdateWishlist();
}
function _pdpUpdateWishlist() {
  const id = _pdpProduct?.id;
  if (!id) return;
  const wishlisted = _pdpGetWishlist().includes(id);
  const btn = document.getElementById('pdpWishlistBtn');
  if (!btn) return;
  btn.classList.toggle('pdp__gallery-wish--active', wishlisted);
  const svg = btn.querySelector('svg');
  if (svg) {
    svg.setAttribute('fill', wishlisted ? '#e74c3c' : 'none');
    svg.setAttribute('stroke', wishlisted ? '#e74c3c' : '#888');
  }
}

/* ── Share ── */
function _pdpShareWA() {
  const url = window.location.href;
  const text = `Check out this cake from Krispie's: ${_pdpProduct?.name || ''} — ${url}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}
function _pdpCopyLink() {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.querySelector('.pdp__share-btn[onclick*="CopyLink"]');
    if (btn) { const orig = btn.textContent; btn.textContent = '✓ Copied!'; setTimeout(() => { btn.textContent = orig; }, 2000); }
  }).catch(() => {
    prompt('Copy this link:', url);
  });
}

// Shows up to 4 other products below the main listing -- same category
// first, filled out with other active products if the category is thin.
function _pdpRenderRelated() {
  const p = _pdpProduct;
  const section = document.getElementById('pdpRelatedSection');
  const grid = document.getElementById('pdpRelatedGrid');
  if (!section || !grid) return;
  const others = getProducts().filter(x => x.id !== p.id && x.active !== false);
  const sameCategory = others.filter(x => x.category === p.category);
  const rest = others.filter(x => x.category !== p.category);
  const picks = [...sameCategory, ...rest].slice(0, 4);
  if (!picks.length) return;
  grid.innerHTML = picks.map(renderCard).join('');
  section.style.display = '';
  initGalleries();
}

// Fetches the individual real ratings for this product from the backend
// (name, area, star rating, date, and review text where available --
// older seeded ratings predate text and simply omit it, see reviews.js)
// and plays them below the main product block as a continuously-scrolling
// carousel (paused on hover/touch). The aggregate rating shown in the
// header above always reflects the true total (p.ratingAvg/ratingCount,
// computed backend-side over every review) -- capping the carousel to the
// most compelling ~24 cards here only affects which individual reviews
// are on display, never the advertised average or count.
const PDP_RATINGS_CAROUSEL_CAP = 24;

function _pdpRatingItemHtml(r) {
  const stars = Math.min(5, Math.max(0, Math.round(r.rating)));
  return `
  <div class="pdp__rating-item">
    <div class="pdp__rating-item-top">
      <span class="pdp__rating-item-name">${esc(r.name)}</span>
      <span class="pdp__rating-item-stars">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</span>
    </div>
    <div class="pdp__rating-item-meta">${esc(r.area || '')}${r.date ? ` · ${esc(new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))}` : ''}</div>
    ${r.text ? `<div class="pdp__rating-item-text">${esc(r.text)}</div>` : ''}
  </div>`;
}

async function _pdpRenderRatings(slug) {
  const section = document.getElementById('pdpRatingsSection');
  const track = document.getElementById('pdpRatingsList');
  if (!section || !track) return;
  try {
    const res = await fetch(`${BACKEND_URL}/api/reviews/${encodeURIComponent(slug)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.count) return;

    // Reviews with written text lead (most persuasive to shoppers), then
    // star-only ratings -- each group keeps the backend's newest-first order.
    const withText = data.reviews.filter(r => r.text);
    const withoutText = data.reviews.filter(r => !r.text);
    const picks = [...withText, ...withoutText].slice(0, PDP_RATINGS_CAROUSEL_CAP);

    // Rendered twice back-to-back so the marquee animation (translateX 0 to
    // -50%) loops seamlessly instead of jumping when it reaches the end.
    const cardsHtml = picks.map(_pdpRatingItemHtml).join('');
    track.innerHTML = cardsHtml + cardsHtml;
    track.style.animationDuration = `${picks.length * 4}s`;

    const pause = () => track.classList.add('paused');
    const resume = () => track.classList.remove('paused');
    track.addEventListener('pointerenter', pause);
    track.addEventListener('pointerleave', resume);
    track.addEventListener('pointerdown', pause);
    track.addEventListener('pointerup', resume);

    section.style.display = '';
  } catch (_) {
    // Silently skip -- ratings are supplementary, not critical path.
  }
}

function _pdpInjectJsonLd(p) {
  // Uploaded images are already absolute (Render /uploads URLs); only
  // repo-relative asset paths need the site prefix.
  const images = (p.images || []).filter(Boolean)
    .map(img => /^https?:\/\//i.test(img) ? img : `https://www.krispies.in/${img.replace(/^\/+/, '')}`);
  const url = `https://www.krispies.in/products/${p.slug}`;
  const ld = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: p.name,
    description: p.description || '',
    sku: p.id,
    url,
    ...(images.length ? { image: images } : {}),
    brand: { '@type': 'Brand', name: "Krispie's" },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'INR',
      price: p.priceFrom ?? p.price ?? 0,
      availability: p.active ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: "Krispie's" },
    },
    ...(p.ratingCount > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: p.ratingAvg,
        reviewCount: p.ratingCount,
      },
    } : {}),
  };
  let script = document.getElementById('pdpJsonLd');
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'pdpJsonLd';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(ld);
}

function _pdpNotFound() {
  document.getElementById('pdpContainer').innerHTML = `
    <div class="pdp__empty">
      <h2 style="font-family:var(--font-display);color:var(--text-on-light);margin-bottom:10px;">Product not found</h2>
      <p>This item may have been removed or the link is incorrect.</p>
      <a href="menu" class="btn btn-gold" style="display:inline-block;margin-top:20px;">Browse the Menu →</a>
    </div>`;
}

document.addEventListener('shop:ready', () => {
  const slug = _pdpSlugFromUrl();
  const products = getProducts();
  const p = products.find(x => x.slug === slug || x.id === slug);
  // #pdpSsr means the server found this product (functions/products/[slug].js)
  // -- a miss here is our own product fetch failing, not a missing product.
  if (!p) { if (!document.getElementById('pdpSsr')) _pdpNotFound(); return; }
  _pdpProduct = p;
  // Scopes the pink/festive CTA theming (see css/styles.css's
  // body.rakhi-theme rules) to just this product's page -- doesn't touch
  // any other product's Buy Now/Add to Cart styling.
  document.body.classList.toggle('rakhi-theme', p.category === 'rakhi-hampers');
  if (typeof krTrackViewContent === 'function') krTrackViewContent(p);
  document.title = `${p.name} — Krispie's`;
  const descEl = document.getElementById('pageDesc');
  if (descEl) descEl.setAttribute('content', p.description || '');
  const canonEl = document.getElementById('pageCanonical');
  if (canonEl) canonEl.setAttribute('href', `https://www.krispies.in/products/${p.slug}`);
  _pdpInjectJsonLd(p);
  _pdpRender();
  _pdpRenderRelated();
  _pdpRenderRatings(p.slug);
});
