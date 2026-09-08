'use strict';

const db = require('../db/database');

/**
 * express-rate-limit's default store keeps hit counts in per-process memory.
 * That only works if the app runs as a single process -- this backend runs
 * as multiple instances/processes behind Render's load balancer, so each
 * one keeps its own independent counter. In practice that means every
 * in-memory rate limiter is bypassable just by sending enough requests:
 * confirmed live by sending 12 requests to a "10 per 15 min" limiter and
 * watching it never trip, because requests were being spread across
 * separate counters.
 *
 * This is a drop-in-ish replacement backed by the `rate_limit_hits` table,
 * which lives on the same SQLite file every instance reads and writes --
 * a hit recorded by one instance is immediately visible to all the others.
 */
function dbRateLimit({ windowMs, max, keyGenerator, message }) {
  const errorBody = message || { error: 'Too many requests. Please try again later.' };

  return (req, res, next) => {
    const bucket = keyGenerator ? keyGenerator(req) : req.ip;
    const windowStart = new Date(Date.now() - windowMs).toISOString().replace('T', ' ').slice(0, 19);

    // Opportunistic cleanup for this bucket -- keeps the table small without
    // needing a separate scheduled job, same pattern used for email_otps.
    db.prepare(`DELETE FROM rate_limit_hits WHERE bucket = ? AND created_at < ?`).run(bucket, windowStart);

    const { c } = db.prepare(
      `SELECT COUNT(*) as c FROM rate_limit_hits WHERE bucket = ? AND created_at >= ?`
    ).get(bucket, windowStart);

    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(Math.max(0, max - c - 1)));

    if (c >= max) {
      return res.status(429).json(errorBody);
    }

    db.prepare(`INSERT INTO rate_limit_hits (bucket) VALUES (?)`).run(bucket);
    next();
  };
}

module.exports = { dbRateLimit };
