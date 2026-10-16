import {
  SITE, OUTLETS, getCatalog, esc, jsonForScript, productUrl, productImages,
  priceText, categoryLabel, deliveryText, productJsonLd, CATEGORY_PAGES,
} from '../_shared/catalog.js';

// This Function takes precedence over _redirects, so the "old deleted
// products" 301s listed there never ran for /products/* -- they live here
// instead.
const LEGACY_REDIRECTS = {
  'coconut-cookies-200-grams': '/biscuits',
  'chocoholic-master-cake-2-kg': '/birthday-cakes',
  'pink-barbie-cake-2-kg': '/birthday-cakes',
  '1-year-blue-themed-cake-5-kgs': '/birthday-cakes',
};

// Serves product-page.html for /products/<slug>, with the product's name,
// price, photos, description and structured data rendered into the HTML so
// crawlers that don't run JavaScript (AI crawlers in particular) can read
// it. See functions/_shared/catalog.js.
export async function onRequest(context) {
  const { request, env, params } = context;
  const slug = decodeURIComponent(String(params.slug || ''));

  if (LEGACY_REDIRECTS[slug]) {
    return Response.redirect(new URL(LEGACY_REDIRECTS[slug], request.url).toString(), 301);
  }

  const res = await fetchProductPageShell(request, env);
  if (!res.ok || request.method !== 'GET') return res;

  let catalog = await getCatalog(context);
  let p = catalog && catalog.find((x) => x.slug === slug || x.id === slug);
  if (catalog && !p) {
    // Might just be newer than our cached copy -- recheck before a 404.
    catalog = await getCatalog(context, { maxAgeMs: 60 * 1000 });
    p = catalog && catalog.find((x) => x.slug === slug || x.id === slug);
  }

  if (!catalog) return res; // backend unreachable and nothing cached: unchanged page
  if (!p) {
    // The page's own JS renders "Product not found"; make the status match
    // so search engines drop dead product URLs instead of indexing a
    // soft-404.
    return new HTMLRewriter()
      .on('head', { element(el) { el.append('<meta name="robots" content="noindex">', { html: true }); } })
      .transform(new Response(res.body, { status: 404, headers: res.headers }));
  }

  return renderProduct(res, p);
}

// env.ASSETS.fetch() runs through the same html-extension-stripping
// middleware used for ordinary static requests, so fetching the literal
// "/product-page.html" path internally returns a 308 to "/product-page"
// instead of the file's bytes -- and a naive Function would forward that
// redirect straight to the browser. Fetching the already-canonical
// extensionless path avoids that; the redirect-follow below is just a
// safety net in case that behavior ever changes.
async function fetchProductPageShell(request, env) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = '/product-page';
  let res = await env.ASSETS.fetch(new Request(assetUrl, request));
  if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
    const redirected = new URL(res.headers.get('location'), assetUrl);
    res = await env.ASSETS.fetch(new Request(redirected, request));
  }
  return res;
}

function renderProduct(res, p) {
  const url = productUrl(p);
  const images = productImages(p);
  const catLabel = categoryLabel(p.category);
  const catHref = CATEGORY_PAGES[p.category] ? `/${p.category}` : '/menu';
  const title = `${p.name} | ${catLabel} in Hyderabad | Krispie's`;
  const desc = `${p.name} from Krispie's, Hyderabad — ${priceText(p)}. ${p.description || ''}`
    .replace(/\s+/g, ' ').trim().slice(0, 300);

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: catLabel, item: `${SITE}${catHref}` },
      { '@type': 'ListItem', position: 3, name: p.name, item: url },
    ],
  };

  const og = [
    ['og:type', 'product'], ['og:site_name', "Krispie's"], ['og:title', title],
    ['og:description', desc], ['og:url', url], ...(images[0] ? [['og:image', images[0]]] : []),
  ].map(([k, v]) => `<meta property="${k}" content="${esc(v)}">`).join('');

  const rating = p.ratingCount > 0
    ? `<div class="pdp__rating"><span class="pdp__rating-stars">★</span><span class="pdp__rating-value">${esc(p.ratingAvg)}</span><span class="pdp__rating-count">(${esc(p.ratingCount)} customer ratings)</span></div>`
    : '';

  // Same slot the page's own JS fills (#pdpContainer); shop.js/product-
  // detail.js overwrite it with the interactive version once loaded.
  const body = `<div id="pdpSsr">`
    + `<div class="pdp__breadcrumb"><a href="/">Home</a> / <a href="${catHref}">${esc(catLabel)}</a> / ${esc(p.name)}</div>`
    + `<div class="pdp__grid"><div class="pdp__gallery-col"><div class="pdp__gallery">`
    + (images[0] ? `<img src="${esc(images[0])}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover;display:block;">` : '')
    + `</div></div><div>`
    + `<h1 class="pdp__title">${esc(p.name)}</h1>`
    + rating
    + `<div class="pdp__price-row"><span class="pdp__price">${esc(priceText(p))}</span></div>`
    + `<p class="pdp__desc">${esc(p.description)}</p>`
    + `<p class="pdp__desc">${esc(deliveryText(p))} Freshly made by Krispie's, a Hyderabad bakery since 1996, with outlets in ${OUTLETS.join(', ')}.</p>`
    + `</div></div></div>`;

  return new HTMLRewriter()
    .on('title', { element(el) { el.setInnerContent(title); } })
    .on('meta#pageDesc', { element(el) { el.setAttribute('content', desc); } })
    .on('link#pageCanonical', { element(el) { el.setAttribute('href', url); } })
    .on('head', {
      element(el) {
        el.append(og
          + `<script type="application/ld+json" id="pdpJsonLd">${jsonForScript(productJsonLd(p))}</script>`
          + `<script type="application/ld+json">${jsonForScript(breadcrumbLd)}</script>`, { html: true });
      },
    })
    .on('#pdpLoading', { element(el) { el.replace(body, { html: true }); } })
    .transform(res);
}
