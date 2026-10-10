import { SITE, OUTLETS, CATEGORY_PAGES, getCatalog, productUrl, priceText, categoryLabel } from './_shared/catalog.js';

// /llms.txt (https://llmstxt.org): a plain-markdown summary of the business
// for AI assistants and their crawlers. Built from the live catalog so the
// categories, prices and ratings in it never go stale; the business facts
// below mirror index.html's Bakery JSON-LD -- keep them in sync.
export async function onRequestGet(context) {
  const catalog = (await getCatalog(context)) || [];

  const lines = [
    "# Krispie's",
    '',
    "> Krispie's is a celebration cake bakery in Hyderabad, India, baking since 1996 in the Iyengar bakery tradition. "
      + 'It makes birthday, engagement, wedding, anniversary, baby shower, half-year birthday, gender reveal, bento and '
      + `fully customised theme cakes, with ${OUTLETS.length} outlets across Hyderabad and same-day cake delivery across Hyderabad pincodes.`,
    '',
    '## Key facts',
    '',
    `- Website and online ordering: ${SITE}`,
    '- City: Hyderabad, Telangana, India',
    `- Outlets: ${OUTLETS.join(', ')}`,
    '- Founded: 1996 (Iyengar baking heritage)',
    '- Tagline: Your Celebrations Partner',
    '- Phone / WhatsApp: +91 79752 18850',
    '- Delivery: same-day cake delivery across Hyderabad (order before 2 PM); store pickup at any outlet',
    '- Online payment: UPI, cards, netbanking and wallets via Razorpay',
    '- Also on: Zomato, Swiggy, Instagram (@krispies.in), Facebook (krispies.in)',
    '- Custom and bulk orders: wedding, engagement and corporate orders, theme cakes made to a reference photo',
    '',
    '## Cake categories',
    '',
  ];

  for (const [cat, label] of Object.entries(CATEGORY_PAGES)) {
    const items = catalog.filter((p) => p.category === cat);
    const prices = items.map((p) => Number(p.priceFrom ?? p.price) || 0).filter(Boolean);
    const from = prices.length ? ` — from ₹${Math.min(...prices).toLocaleString('en-IN')}` : '';
    const count = items.length ? `, ${items.length} designs` : '';
    lines.push(`- [${label}](${SITE}/${cat})${from}${count}`);
  }

  const rated = catalog
    .filter((p) => p.ratingCount > 0 && p.ratingAvg)
    .sort((a, b) => (b.ratingAvg - a.ratingAvg) || (b.ratingCount - a.ratingCount))
    .slice(0, 20);
  if (rated.length) {
    lines.push('', "## Top-rated cakes (ratings from Krispie's customers' orders)", '');
    for (const p of rated) {
      lines.push(`- [${p.name}](${productUrl(p)}) — ${categoryLabel(p.category)}, ${priceText(p)}, `
        + `rated ${p.ratingAvg}/5 from ${p.ratingCount} ratings`);
    }
  }

  lines.push(
    '',
    '## More',
    '',
    `- [Full menu](${SITE}/menu)`,
    `- [Our story](${SITE}/story)`,
    `- [Store locations](${SITE}/stores/)`,
    `- [Bulk and corporate orders](${SITE}/wholesale-bakery-orders)`,
    `- [Cake guides and articles](${SITE}/articles/)`,
    `- [Contact](${SITE}/contact)`,
    '',
  );

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
