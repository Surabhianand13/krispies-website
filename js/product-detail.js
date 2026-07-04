/* ════════════════════════════════════════════════════════════════════════
   Krispie's — product.html detail page logic.
   Requires js/shop.js to already be loaded (uses getProducts, esc,
   productBasePrice, variantSelectionDelta, addToCart, openCheckout, CAT_SVG).
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

  const base = productBasePrice(p);
  const delta = hasVariants ? variantSelectionDelta(p, _pdpSelection) : 0;
  const finalPrice = base + delta;
  const mrp = Number(p.mrp) || 0;
  const discount = Number(p.discount) || 0;

  const tagColours = { bestseller:'#A84838', new:'#1a7a3c', seasonal:'#1e5f85', custom:'#7b3f9e' };
  const tagHtml = p.tag ? `<span class="pdp__tag" style="background:${tagColours[p.tag]||'#A84838'}">${TAG_LABELS[p.tag] || p.tag}</span>` : '';

  const mainImg = hasImgs ? imgs[_pdpGalleryIndex] || imgs[0] : null;
  const galleryHtml = `
    <div class="pdp__gallery">
      ${mainImg
        ? `<img src="${esc(mainImg)}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover;display:block;">`
        : `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#fdf0ec 0%,#f5e6e0 100%);">
             <div style="width:64px;height:64px;color:var(--gold-dark)">${emoji}</div>
             <div style="font-size:0.78rem;color:#b08070;margin-top:10px;font-weight:500;">Photo coming soon</div>
           </div>`}
    </div>
    ${imgs.length > 1 ? `
      <div class="pdp__thumbs">
        ${imgs.map((url, i) => `
          <div class="pdp__thumb${i === _pdpGalleryIndex ? ' active' : ''}" onclick="_pdpSetGalleryIndex(${i})">
            <img src="${esc(url)}" alt="${esc(p.name)} ${i+1}">
          </div>`).join('')}
      </div>` : ''}
  `;

  const variantHtml = hasVariants ? p.variantGroups.map(g => `
    <div class="chk-field-group">
      <label class="chk-label">${esc(g.name)} *</label>
      <select class="chk-input" onchange="_pdpVariantChange('${esc(g.name)}', this.value)">
        ${g.options.map((o, i) => `<option value="${i}" ${_pdpSelection[g.name] === i ? 'selected' : ''}>${esc(o.label)}${o.priceDelta ? ` (+₹${o.priceDelta.toLocaleString('en-IN')})` : ''}</option>`).join('')}
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
      <div>${galleryHtml}</div>
      <div>
        ${tagHtml}
        <h1 class="pdp__title">${esc(p.name)}</h1>
        <p class="pdp__desc">${esc(p.description)}</p>
        <div class="pdp__price-row" id="pdpPriceRow">
          <span class="pdp__price">₹${finalPrice.toLocaleString('en-IN')}</span>
          ${discount > 0 && !hasVariants ? `<span class="pdp__mrp">₹${mrp.toLocaleString('en-IN')}</span>` : ''}
          ${discount > 0 && !hasVariants ? `<span class="pdp__discount">${discount}% OFF</span>` : ''}
        </div>

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
          <button class="btn btn-outline" onclick="_pdpAddToCart()">🛒 Add to Cart</button>
          <button class="btn btn-gold" onclick="_pdpBuyNow()">Buy Now →</button>
        </div>
      </div>
    </div>`;
}

let _pdpQtyValue = 1;

function _pdpSetGalleryIndex(i) {
  _pdpGalleryIndex = i;
  _pdpRender();
}

function _pdpVariantChange(groupName, optionIndex) {
  _pdpSelection[groupName] = Number(optionIndex);
  const p = _pdpProduct;
  const finalPrice = productBasePrice(p) + variantSelectionDelta(p, _pdpSelection);
  const row = document.getElementById('pdpPriceRow');
  if (row) row.innerHTML = `<span class="pdp__price">₹${finalPrice.toLocaleString('en-IN')}</span>`;
}

function _pdpQty(delta) {
  _pdpQtyValue = Math.max(1, Math.min(99, _pdpQtyValue + delta));
  const el = document.getElementById('pdpQtyVal');
  if (el) el.textContent = _pdpQtyValue;
}

function _pdpAddToCart() {
  addToCart(_pdpProduct.id, _pdpProduct.variantGroups?.length ? _pdpSelection : null);
}

function _pdpBuyNow() {
  openCheckout(_pdpProduct.id);
  _chkCart.qty = _pdpQtyValue;
  if (_pdpProduct.variantGroups?.length) _chkCart.variantSelection = { ..._pdpSelection };
  _chkRenderStep(1);
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
  if (!p) { _pdpNotFound(); return; }
  _pdpProduct = p;
  document.title = `${p.name} — Krispie's`;
  const descEl = document.getElementById('pageDesc');
  if (descEl) descEl.setAttribute('content', p.description || '');
  const canonEl = document.getElementById('pageCanonical');
  if (canonEl) canonEl.setAttribute('href', `https://www.krispies.in/products/${p.slug}`);
  _pdpRender();
});
