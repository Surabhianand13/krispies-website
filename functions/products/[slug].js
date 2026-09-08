// Serves product-page.html for /products/<slug> without leaking Cloudflare
// Pages' internal clean-URL handling out to the client.
//
// env.ASSETS.fetch() runs through the same html-extension-stripping
// middleware used for ordinary static requests, so fetching the literal
// "/product-page.html" path internally returns a 308 to "/product-page"
// instead of the file's bytes -- and a naive Function would forward that
// redirect straight to the browser. Fetching the already-canonical
// extensionless path avoids that; the redirect-follow below is just a
// safety net in case that behavior ever changes.
export async function onRequest({ request, env }) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = '/product-page';
  let res = await env.ASSETS.fetch(new Request(assetUrl, request));
  if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
    const redirected = new URL(res.headers.get('location'), assetUrl);
    res = await env.ASSETS.fetch(new Request(redirected, request));
  }
  return res;
}
