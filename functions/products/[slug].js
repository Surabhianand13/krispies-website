// Serves product-page.html for /products/<slug> without going through
// Cloudflare Pages' automatic clean-URL canonicalization, which redirects
// any _redirects rewrite whose destination is a real top-level static
// .html file back to that file's own bare alias (see _redirects history).
// Fetching the asset from within a Function and returning it directly
// keeps the visible URL as /products/<slug>.
export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  url.pathname = '/product-page.html';
  return env.ASSETS.fetch(new Request(url, request));
}
