'use strict';

// Shared whitelists for fields that flow into admin-panel HTML rendering.
// These must stay validated server-side (not just checked client-side by
// the storefront UI) because /api/messages and /api/checkout are public,
// unauthenticated endpoints -- anyone can POST to them directly with any
// value, bypassing the frontend entirely.
const VALID_OUTLETS = ['lalbazar', 'suchitra', 'boduppal', 'ramantapur', 'tukkuguda', 'any'];

const VALID_EVENT_TYPES = [
  'birthday', 'wedding', 'anniversary', 'baby-shower',
  'corporate', 'graduation', 'festival', 'other',
];

module.exports = { VALID_OUTLETS, VALID_EVENT_TYPES };
