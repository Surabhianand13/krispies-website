'use strict';

/**
 * Verifies a Cloudflare Turnstile token server-side against Cloudflare's
 * siteverify API. Call this from a route handler with the request; it
 * returns null on success or { status, error } on failure -- respond with
 * res.status(result.status).json({ error: result.error }).
 *
 * Deliberately fails OPEN (skips the check) whenever TURNSTILE_SECRET_KEY
 * isn't set, in every environment -- unlike Razorpay, this isn't a hard
 * dependency the endpoint can't function without; it's one extra layer of
 * bot-defense on top of an otherwise-complete checkout/signup/contact flow.
 * Failing closed here would mean shipping this code before the Cloudflare
 * side is actually configured turns into an accidental site-wide outage of
 * every form (including checkout) instead of just a missing extra check.
 * Still logs loudly so a forgotten key doesn't go unnoticed.
 */
async function verifyTurnstileToken(req) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    console.warn('[Turnstile] TURNSTILE_SECRET_KEY not set -- skipping verification.');
    return null;
  }

  const token = req.body && req.body.turnstileToken;
  if (!token) {
    return { status: 400, error: 'Verification required. Please refresh the page and try again.' };
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', token);
    if (req.ip) params.append('remoteip', req.ip);

    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: params,
    });
    const data = await verifyRes.json();

    if (!data.success) {
      console.warn('[Turnstile] verification failed:', data['error-codes']);
      return { status: 400, error: 'Verification failed. Please refresh the page and try again.' };
    }
    return null;
  } catch (err) {
    console.error('[Turnstile] siteverify request failed:', err.message || err);
    return { status: 503, error: 'Verification service unavailable. Please try again.' };
  }
}

module.exports = { verifyTurnstileToken };
