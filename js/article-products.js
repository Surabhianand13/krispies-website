// Renders a "Trending Products" recommendation section inside article pages.
// The section div carries data-category (e.g. "wedding-cakes" or "featured")
// and data-title / data-link for the heading + "view all" URL.
// main.js must be loaded first so BACKEND_URL is available.
(function () {
  var grid = document.getElementById('article-product-grid');
  if (!grid) return;

  var cat   = grid.dataset.category || 'featured';
  var CACHE = 'krispies_products';

  function fromCache() {
    try { var r = localStorage.getItem(CACHE); return r ? JSON.parse(r) : null; } catch(e) { return null; }
  }

  function filter(products) {
    if (!products || !products.length) return [];
    var active = products.filter(function(p){ return p.active !== false; });
    var filtered;
    if (cat === 'featured') {
      filtered = active.filter(function(p){ return p.featured || p.trending; });
      if (!filtered.length) filtered = active.slice();
    } else {
      filtered = active.filter(function(p){ return p.category === cat; });
      if (!filtered.length) filtered = active.filter(function(p){ return p.featured || p.trending; });
    }
    filtered.sort(function(a, b) {
      var aS = (a.trending?2:0)+(a.tag==='bestseller'?1:0);
      var bS = (b.trending?2:0)+(b.tag==='bestseller'?1:0);
      return bS - aS;
    });
    return filtered.slice(0, 5);
  }

  function price(p) {
    var from = p.priceFrom || p.price || 0;
    var to   = p.priceTo   || 0;
    if (!from) return '';
    var fmt = function(n){ return '₹' + n.toLocaleString('en-IN'); };
    return (to && to > from) ? fmt(from) + ' – ' + fmt(to) : fmt(from);
  }

  function card(p) {
    var img  = p.images && p.images[0] ? p.images[0] : '';
    var slug = p.slug || p.id;
    var pr   = price(p);
    var badge = p.trending ? '🔥 Trending'
              : p.tag === 'bestseller' ? '⭐ Bestseller'
              : p.tag === 'new'        ? '✨ New'
              : p.tag === 'seasonal'   ? '🍂 Seasonal' : '';
    var imgSrc = img ? (img.match(/^(https?:\/\/|\/)/) ? img : '../' + img) : '';
    return '<a class="artprod-card" href="../product.html?slug=' + encodeURIComponent(slug) + '">'
      + '<div class="artprod-img-wrap">'
      + (imgSrc
          ? '<img src="' + imgSrc + '" alt="' + p.name + '" loading="lazy">'
          : '<div class="artprod-placeholder">🎂</div>')
      + (badge ? '<span class="artprod-badge">' + badge + '</span>' : '')
      + '</div>'
      + '<div class="artprod-info">'
      + '<div class="artprod-name">' + p.name + '</div>'
      + (pr ? '<div class="artprod-price">' + pr + '</div>' : '')
      + '<span class="artprod-cta btn btn-gold">Order Now</span>'
      + '</div>'
      + '</a>';
  }

  function render(products) {
    var items = filter(products);
    if (!items.length) {
      var section = grid.closest ? grid.closest('.article-shop-section') : null;
      if (section) section.style.display = 'none';
      return;
    }
    grid.innerHTML = items.map(card).join('');
  }

  var cached = fromCache();
  if (cached) render(cached);

  var base = (typeof BACKEND_URL !== 'undefined' ? BACKEND_URL : '');
  fetch(base + '/api/products')
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(data){
      if (!data) return;
      var list = Array.isArray(data) ? data : (data.products || []);
      try { localStorage.setItem(CACHE, JSON.stringify(list)); } catch(e) {}
      render(list);
    })
    .catch(function(){});
})();
