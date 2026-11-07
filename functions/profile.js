// Serves profile.html at the clean /profile URL.
// Uses the same env.ASSETS.fetch pattern as functions/products/[slug].js:
// fetching the extensionless path avoids the 308 that ASSETS returns for the
// literal .html path (which would be forwarded straight to the browser).
export async function onRequest({ request, env, next }) {
  if (request.method !== 'GET') return next();
  const url = new URL(request.url);
  url.pathname = '/profile';
  let res = await env.ASSETS.fetch(new Request(url, request));
  // Safety net: follow any redirect ASSETS emits (e.g. future path changes)
  if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
    const redirected = new URL(res.headers.get('location'), url);
    res = await env.ASSETS.fetch(new Request(redirected, request));
  }
  return res;
}
