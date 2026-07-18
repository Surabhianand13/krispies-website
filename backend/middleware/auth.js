'use strict';

const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Customer tokens share the same signing secret as admin tokens, so a
    // customer's JWT would otherwise pass signature verification here too
    // and get treated as an admin session -- explicitly reject it.
    if (payload.type === 'customer') {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// Customer-facing auth -- deliberately separate from requireAuth (admin) so
// a customer session can never be used to call admin-only routes, and vice
// versa an admin token is never accepted here.
function requireCustomerAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Please log in to continue.' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'customer') {
      return res.status(401).json({ error: 'Please log in to continue.' });
    }
    req.customer = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

// Like requireCustomerAuth, but doesn't fail the request if there's no/an
// invalid token -- used on checkout so guests can still place orders while
// logged-in customers automatically get their order linked to their account.
function optionalCustomerAuth(req, _res, next) {
  const header = req.headers['authorization'];
  if (header && header.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
      if (payload.type === 'customer') req.customer = payload;
    } catch (_) { /* ignore -- treat as guest */ }
  }
  next();
}

module.exports = { requireAuth, requireCustomerAuth, optionalCustomerAuth };
