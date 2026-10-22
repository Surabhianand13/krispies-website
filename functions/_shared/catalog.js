// Shared helpers for server-rendering product data into otherwise
// JS-rendered pages. Not a route: Pages only turns modules that export an
// onRequest* handler into routes, and this one exports none.
//
// Why this exists: shop.js builds every product grid and product page in
// the browser from GET /api/products. Search engines partly cope with that,
// but AI crawlers (GPTBot, ClaudeBot, PerplexityBot, ...) don't run
// JavaScript at all -- to them a category page was "Loading cakes..." and a
// product page was an empty shell. The Functions that import this put the
// same catalog into the HTML itself; shop.js still re-renders over it
// client-side exactly as before.
//
// The backend is on Render's free tier, which sleeps and takes ~30s to wake.
// A page must never wait on that, so the catalog is cached (per-isolate
// memory + the Cloudflare Cache API) and refreshed in the background once
// stale. If there's no cached copy at all and the backend doesn't answer
// within FIRST_WAIT_MS, callers get null and serve the page unchanged --
// the exact pre-existing behaviour, never worse.

export const SITE = 'https://www.krispies.in';
const API_URL = 'https://krispies-website.onrender.com/api/products';
const FRESH_MS = 10 * 60 * 1000;
const FIRST_WAIT_MS = 800; // was 4000 — long TTFB hurt FCP; serve uncached page in <1s
const REFRESH_TIMEOUT_MS = 25000;

// Category keys that have their own landing page at /<key>.
export const CATEGORY_PAGES = {
  'birthday-cakes':           'Birthday Cakes',
  'wedding-cakes':            'Wedding Cakes',
  'engagement-cakes':         'Engagement Cakes',
  'baby-shower-cakes':        'Kids Birthday & Baby Shower Cakes',
  'half-year-birthday-cakes': 'Half Year Birthday Cakes',
  'gender-reveal-cakes':      'Gender Reveal Cakes',
  'customized-cakes':         'Customized Cakes',
  'love-cakes':               'Love Cakes (Him/Her)',
  'floral-cakes':             'Floral Cakes',
  'bento-cakes':              'Bento Cakes',
  'super-hero-cakes':         'Super Hero Cakes',
  'anime-cakes':              'Anime Cakes',
  'number-alphabet-cakes':    'Number & Alphabet Cakes',
  'bon-voyage-cakes':         'Bon Voyage Cakes',
  'trending-cakes':           'Trending Cakes',
  'cheesecakes':              'Cheesecakes',
  'donuts':                   'Donuts',
  'flowers-bouquets':         'Flowers & Bouquets',
};

export const OUTLETS = ['Lalbazar', 'Suchitra', 'Boduppal', 'Ramanthapur', 'Tukkuguda'];

let mem = null;       // { at: epoch ms, products: [] }
let inflight = null;  // Promise<products> while a refresh is running

function cacheKey(request) {
  return new Request(new URL('/__catalog-cache/v1', request.url).toString());
}

async function refresh(request) {
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await fetch(API_URL, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`catalog fetch ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('catalog: expected an array');
    const products = data.filter((p) => p && p.slug && p.active !== false);
    mem = { at: Date.now(), products };
    await caches.default.put(cacheKey(request), new Response(JSON.stringify(products), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=604800',
        'x-fetched-at': String(mem.at),
      },
    }));
    return products;
  })().finally(() => { inflight = null; });
  return inflight;
}

// Returns the active product list, or null if none is available yet.
// `maxAgeMs` lets a caller demand a fresher copy (awaited, bounded by
// FIRST_WAIT_MS) -- used before 404ing a product slug that may simply have
// been added in admin after the cached copy was taken.
export async function getCatalog({ request, waitUntil }, { maxAgeMs } = {}) {
  if (!mem) {
    try {
      const hit = await caches.default.match(cacheKey(request));
      if (hit) mem = { at: Number(hit.headers.get('x-fetched-at')) || 0, products: await hit.json() };
    } catch (_) { /* cache miss or unreadable -- fall through to a fetch */ }
  }

  const age = mem ? Date.now() - mem.at : Infinity;
  if (mem && age < (maxAgeMs ?? FRESH_MS)) return mem.products;

  const pending = refresh(request);
  waitUntil(pending.catch(() => {}));
  if (mem && maxAgeMs == null) return mem.products; // stale-while-revalidate

  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), FIRST_WAIT_MS));
  const fresh = await Promise.race([pending.catch(() => null), timeout]);
  return fresh || (mem ? mem.products : null);
}

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// JSON for inside a <script> tag: "</script>" in a product description
// must not be able to close the tag early.
export function jsonForScript(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

export function productUrl(p) {
  return `${SITE}/products/${encodeURIComponent(p.slug)}`;
}

export function absImage(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE}/${String(url).replace(/^\/+/, '')}`;
}

export function productImages(p) {
  return (p.images || []).filter(Boolean).map(absImage);
}

function priceRange(p) {
  const from = Number(p.priceFrom ?? p.price) || 0;
  const to = Number(p.priceTo ?? from) || from;
  return { from, to };
}

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

export function priceText(p) {
  const { from, to } = priceRange(p);
  if (!from) return 'Price on request';
  return to > from ? `${inr(from)} – ${inr(to)}` : inr(from);
}

export function categoryLabel(cat) {
  return CATEGORY_PAGES[cat]
    || String(cat || '').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function deliveryText(p) {
  const hours = Number(p.prepHours) || 0;
  return hours === 0
    ? 'Same-day delivery available across Hyderabad.'
    : `Please order at least ${hours} hour${hours === 1 ? '' : 's'} in advance.`;
}

export function productJsonLd(p) {
  const url = productUrl(p);
  const images = productImages(p);
  const { from, to } = priceRange(p);
  const seller = { '@type': 'Bakery', name: "Krispie's", url: SITE };
  const availability = 'https://schema.org/InStock';
  const ld = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: p.name,
    description: p.description || '',
    sku: p.id,
    url,
    category: categoryLabel(p.category),
    ...(images.length ? { image: images } : {}),
    brand: { '@type': 'Brand', name: "Krispie's" },
  };
  if (from) {
    ld.offers = to > from
      ? { '@type': 'AggregateOffer', url, priceCurrency: 'INR', lowPrice: from, highPrice: to, availability, seller }
      : { '@type': 'Offer', url, priceCurrency: 'INR', price: from, availability, itemCondition: 'https://schema.org/NewCondition', seller };
  }
  if (p.ratingCount > 0 && p.ratingAvg) {
    ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: p.ratingAvg, reviewCount: p.ratingCount, bestRating: 5 };
  }
  return ld;
}

// Lightweight card using shop.js's .pcard classes so the server-rendered
// grid looks close to the real one for the moment before shop.js replaces it
// (and stays usable if JS never runs).
export function productCardHtml(p, { eager = false } = {}) {
  const url = `/products/${encodeURIComponent(p.slug)}`;
  const img = productImages(p)[0];
  const rating = p.ratingCount > 0
    ? `<div class="pcard__rating"><span class="pcard__rating-star">★</span><span class="pcard__rating-value">${esc(p.ratingAvg)}</span><span class="pcard__rating-count">(${esc(p.ratingCount)})</span></div>`
    : '';
  const imgAttrs = eager
    ? `loading="eager" fetchpriority="high"`
    : `loading="lazy"`;
  return `<div class="pcard">`
    + `<a class="pcard__gallery" href="${url}"><div class="pcard__gal-track"><div class="pcard__gal-slide">`
    + (img ? `<img src="${esc(img)}" alt="${esc(p.name)}" ${imgAttrs}>` : '')
    + `</div></div></a>`
    + `<div class="pcard__body">`
    + `<h3 class="pcard__name"><a href="${url}" style="text-decoration:none;color:inherit;">${esc(p.name)}</a></h3>`
    + rating
    + `<p class="pcard__desc">${esc(p.description)}</p>`
    + `<div class="pcard__pricing"><span class="pcard__price">${esc(priceText(p))}</span></div>`
    + `<a class="pcard__btn" href="${url}" style="text-decoration:none;">View Details</a>`
    + `</div></div>`;
}
