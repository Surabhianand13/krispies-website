// Cloudflare Pages deploys this entire git repo as the static site's asset
// root (see CLAUDE.md: "No build step -- serves static files directly").
// That's fine for the frontend, but it also means every file that's
// *tracked in git for the backend's sake* -- backend/**, render.yaml,
// vercel.json, CLAUDE.md, SETUP.md -- is served byte-for-byte to anyone who
// requests it, since there's no build step to leave them out. Confirmed
// live: backend/server.js, every backend/routes/*.js, backend/db/database.js
// and this project's own CLAUDE.md (which documents every past
// vulnerability and fix in detail) were all publicly readable.
//
// A `_redirects` rule can't fix this: Cloudflare Pages serves an existing
// static asset before it ever consults `_redirects`, so a rule for
// `/backend/*` would never even run for a file that's actually present in
// the deploy. Pages Functions middleware runs *before* static-asset
// resolution (this project already relies on that ordering -- see
// functions/products/[slug].js), so returning a Response here without
// calling ASSETS.fetch() is what actually keeps these bytes off the wire.
//
// This is a stopgap, not the real fix: the durable fix is telling
// Cloudflare Pages (dashboard -> this project -> Settings -> Builds ->
// Root directory) to only deploy the frontend's files, so backend/ is never
// uploaded in the first place. Until that's set, this middleware is the
// only thing standing between the internet and the backend's source code.
const BLOCKED_PATTERNS = [
  /^\/backend(\/|$)/i,
  /^\/render\.ya?ml$/i,
  /^\/vercel\.json$/i,
  /^\/claude\.md$/i,
  /^\/setup\.md$/i,
  /^\/\.env(\..*)?$/i,
  /^\/\.git(\/|$)/i,
  /^\/package(-lock)?\.json$/i,
  /\.(db|sqlite3?|sql)(-wal|-shm)?$/i,
];

export async function onRequest({ request, next }) {
  const { pathname } = new URL(request.url);
  if (BLOCKED_PATTERNS.some((re) => re.test(pathname))) {
    return new Response('Not Found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  return next();
}
