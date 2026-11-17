import { getCatalog, productUrl, esc } from './_shared/catalog.js';

// Serves the static sitemap.xml with its hand-maintained /products/ entries
// swapped for the live catalog, so products added (or removed) in admin are
// in the sitemap immediately. Everything else in sitemap.xml -- pages,
// articles, stores -- is still edited by hand there. If the catalog is
// unavailable, the static file is served as-is.
export async function onRequestGet(context) {
  const { request, env } = context;
  const assetUrl = new URL('/sitemap.xml', request.url);
  const res = await env.ASSETS.fetch(new Request(assetUrl, request));
  if (!res.ok) return res;

  const catalog = await getCatalog(context);
  if (!catalog || !catalog.length) return res;

  const xml = await res.text();
  const withoutProducts = xml.replace(/\s*<url>\s*<loc>[^<]*\/products\/[^<]*<\/loc>[\s\S]*?<\/url>/g, '');
  const productEntries = catalog.map((p) => {
    const lastmod = String(p.updatedAt || p.createdAt || '').slice(0, 10);
    return `  <url>\n    <loc>${esc(productUrl(p))}</loc>\n    <changefreq>weekly</changefreq>\n`
      + `    <priority>0.7</priority>\n${/^\d{4}-\d{2}-\d{2}$/.test(lastmod) ? `    <lastmod>${lastmod}</lastmod>\n` : ''}  </url>`;
  }).join('\n');

  return new Response(withoutProducts.replace('</urlset>', `${productEntries}\n</urlset>`), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
