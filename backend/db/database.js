'use strict';

const path    = require('path');
const crypto  = require('crypto');
const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');

// DB_PATH lets Render's persistent disk (mounted outside the ephemeral
// container filesystem) override where the SQLite file lives -- without
// it, the whole database is wiped on every redeploy since the container
// itself is stateless.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'krispies.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Create tables ──────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id             TEXT    PRIMARY KEY,
    name           TEXT    NOT NULL,
    category       TEXT    NOT NULL,
    tag            TEXT,
    flavour        TEXT,
    description    TEXT    NOT NULL,
    mrp            REAL    NOT NULL DEFAULT 0,
    discount       REAL    NOT NULL DEFAULT 0,
    images         TEXT    NOT NULL DEFAULT '[]',
    variant_groups TEXT    NOT NULL DEFAULT '[]',
    prep_hours     INTEGER NOT NULL DEFAULT 0,
    slug           TEXT    UNIQUE,
    featured       INTEGER NOT NULL DEFAULT 0,
    trending       INTEGER NOT NULL DEFAULT 0,
    active         INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id              TEXT    PRIMARY KEY,
    customer_id     TEXT,
    customer_name   TEXT    NOT NULL,
    customer_phone  TEXT,
    customer_email  TEXT,
    items           TEXT    NOT NULL,
    quantity        TEXT,
    amount          REAL,
    platform        TEXT,
    outlet          TEXT,
    order_date      TEXT,
    delivery_date   TEXT,
    status          TEXT    NOT NULL DEFAULT 'pending',
    payment_method  TEXT,
    notes           TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS customers (
    id            TEXT    PRIMARY KEY,
    name          TEXT    NOT NULL,
    phone         TEXT    UNIQUE,
    email         TEXT    UNIQUE,
    password_hash TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS addresses (
    id           TEXT    PRIMARY KEY,
    customer_id  TEXT    NOT NULL,
    label        TEXT    NOT NULL DEFAULT 'Home',
    name         TEXT    NOT NULL,
    phone        TEXT    NOT NULL,
    line         TEXT    NOT NULL,
    city         TEXT    NOT NULL DEFAULT 'Hyderabad',
    pincode      TEXT,
    is_default   INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id          TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    phone       TEXT,
    email       TEXT,
    event_type  TEXT,
    outlet      TEXT,
    quantity    TEXT,
    event_date  TEXT,
    products    TEXT,
    message     TEXT,
    status      TEXT    NOT NULL DEFAULT 'unread',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS page_views (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT,
    path        TEXT    NOT NULL,
    referrer    TEXT,
    device_type TEXT,
    country     TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT,
    type        TEXT    NOT NULL,
    label       TEXT,
    path        TEXT,
    meta        TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS addons (
    id         TEXT    PRIMARY KEY,
    name       TEXT    NOT NULL,
    price      REAL    NOT NULL DEFAULT 0,
    unit       TEXT    NOT NULL DEFAULT 'each',
    image      TEXT    DEFAULT '',
    categories TEXT    NOT NULL DEFAULT '[]',
    active     INTEGER NOT NULL DEFAULT 1,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS email_otps (
    id         TEXT    PRIMARY KEY,
    email      TEXT    NOT NULL,
    otp_hash   TEXT    NOT NULL,
    expires_at TEXT    NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0,
    consumed   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id            TEXT    PRIMARY KEY,
    product_slug  TEXT    NOT NULL,
    customer_name TEXT    NOT NULL,
    area          TEXT,
    geography     TEXT,
    rating        INTEGER NOT NULL,
    review_date   TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Backs middleware/dbRateLimit.js. Rate limiting can't live in per-process
  -- memory (see that file for why) -- this table is on the same shared
  -- SQLite file every instance reads/writes, so a hit counted by one
  -- instance is visible to all of them.
  CREATE TABLE IF NOT EXISTS rate_limit_hits (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    bucket     TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

try { db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_product_slug ON reviews(product_slug)'); } catch (_) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_bucket ON rate_limit_hits(bucket, created_at)'); } catch (_) {}

// ── Safe migrations for existing DBs ──────────────────────────────────────────
const safeAddColumn = (table, col, def) => {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch (_) {}
};
safeAddColumn('products', 'mrp',            'REAL NOT NULL DEFAULT 0');
safeAddColumn('products', 'discount',       'REAL NOT NULL DEFAULT 0');
safeAddColumn('products', 'images',         "TEXT NOT NULL DEFAULT '[]'");
safeAddColumn('products', 'variant_groups', "TEXT NOT NULL DEFAULT '[]'");
safeAddColumn('products', 'prep_hours',     'INTEGER NOT NULL DEFAULT 0');
safeAddColumn('products', 'slug',           'TEXT');
safeAddColumn('products', 'flavour',        'TEXT');
safeAddColumn('products', 'trending',       'INTEGER NOT NULL DEFAULT 0');
safeAddColumn('orders',   'customer_email',     'TEXT');
safeAddColumn('orders',   'payment_method',     'TEXT');
safeAddColumn('orders',   'customer_id',        'TEXT');
safeAddColumn('orders',   'razorpay_order_id',  'TEXT');
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug)'); } catch (_) {}
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)'); } catch (_) {}
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email ON customers(email)'); } catch (_) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_addresses_customer ON addresses(customer_id)'); } catch (_) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps(email)'); } catch (_) {}

// ── One-time migration: customers.phone / customers.password_hash used to be
//    NOT NULL, back when phone+password was the only way to have an account.
//    Email-OTP login can create an account with neither, so an existing DB's
//    columns need to drop that constraint. SQLite has no ALTER COLUMN, so
//    this rebuilds the table -- guarded by inspecting the live schema (not a
//    settings flag) so it's naturally a no-op on any DB where it already ran,
//    including fresh installs that create the column nullable from the start.
const customersPhoneCol = db.prepare("PRAGMA table_info(customers)").all().find(c => c.name === 'phone');
if (customersPhoneCol && customersPhoneCol.notnull === 1) {
  db.exec('PRAGMA foreign_keys = OFF');
  const migrateCustomersNullable = db.transaction(() => {
    db.exec(`
      CREATE TABLE customers_new (
        id            TEXT    PRIMARY KEY,
        name          TEXT    NOT NULL,
        phone         TEXT    UNIQUE,
        email         TEXT    UNIQUE,
        password_hash TEXT,
        created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO customers_new (id, name, phone, email, password_hash, created_at)
        SELECT id, name, phone, email, password_hash, created_at FROM customers;
      DROP TABLE customers;
      ALTER TABLE customers_new RENAME TO customers;
    `);
  });
  migrateCustomersNullable();
  db.exec('PRAGMA foreign_keys = ON');
  try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)'); } catch (_) {}
  try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email ON customers(email)'); } catch (_) {}
  console.log('✓ Migrated customers table: phone/password_hash are now nullable (email-OTP accounts)');
}

// ── Seed admin user ────────────────────────────────────────────────────────────
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  // No hardcoded fallback here on purpose -- a known default password
  // baked into the repo is a live credential the moment the repo is
  // public/shared. If ADMIN_PASSWORD isn't set, generate a random one and
  // print it once so whoever has server log access can retrieve it and
  // change it via POST /api/auth/change-password.
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = crypto.randomBytes(12).toString('base64url');
    console.warn('⚠ ADMIN_PASSWORD not set -- generated a random admin password:');
    console.warn(`  ${password}`);
    console.warn('  Set ADMIN_PASSWORD in your environment and change this password via the admin panel.');
  }
  const hash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', hash);
  console.log('✓ Admin user created');
}

// ── One-time seed/migration: replace the old imageless placeholder catalog
//    with the real, image-backed catalog already live on the public site.
//    This is a STRICTLY ONE-TIME operation guarded by the 'catalog_seeded_v1'
//    settings flag — once it has run, it never runs again, even across future
//    deploys, so it can never wipe products the team adds via admin later.
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const alreadySeeded = db.prepare('SELECT value FROM settings WHERE key = ?').get('catalog_seeded_v1');

if (!alreadySeeded) {
  const mk = (name, category, description, tag, mrp, discount, featured) => {
    const slug = slugify(name);
    return {
      id: 'p_' + slug,
      name, category, description, tag: tag || null,
      mrp, discount: discount || 0,
      images: JSON.stringify([`assets/images/products/${category}/${slug}.jpg`]),
      variant_groups: '[]',
      prep_hours: 0,
      slug,
      featured: featured ? 1 : 0,
      active: 1,
    };
  };

  const catalog = [
    mk('Creamy Rasmalai Cake', 'birthday-cakes', 'Saffron-cardamom sponge soaked in rabri cream, topped with crushed pistachios.', 'bestseller', 899, 10, true),
    mk('Belgium Chocolate Cake', 'birthday-cakes', 'Rich Belgian chocolate sponge with smooth ganache drip and dark chocolate shards.', 'bestseller', 999, 15, true),
    mk('Redvelvet Cake', 'birthday-cakes', 'Striking red velvet layers with luscious cream cheese frosting.', 'bestseller', 1099, 10, true),
    mk('Chocolate Truffle Cake', 'birthday-cakes', 'Decadent chocolate sponge layered with silky truffle ganache and chocolate curls.', 'bestseller', 999, 0, false),
    mk('Fresh Pineapple Cake', 'birthday-cakes', 'Vanilla sponge with fresh pineapple chunks and light chantilly cream.', 'new', 849, 0, false),
    mk('Butterscotch Cake', 'birthday-cakes', 'Crunchy butterscotch praline layered in fluffy fresh cream and vanilla sponge.', null, 849, 10, false),
    mk('Mango Bliss Cake', 'birthday-cakes', 'Alphonso mango sponge layered with mango compote and fresh cream.', 'new', 949, 0, false),
    mk('Double Heart Two-Tier Anniversary Cake', 'wedding-cakes', 'Two-tier heart-shaped cake with red polka dots, red rose bouquets, customisable gold anniversary topper and floating heart accents.', 'bestseller', 4499, 0, true),
    mk('Traditional Bride & Groom Wedding Cake', 'wedding-cakes', 'Classic three-tier white fondant with hand-sculpted burgundy roses, pearl drapery and traditional bride-and-groom topper.', 'bestseller', 4999, 0, true),
    mk('Romantic Pink Rose One Tier Cake', 'wedding-cakes', 'Single tier white with handmade pink roses, gold pearl cascade and soft pink ombre band — intimate and elegant.', 'bestseller', 2999, 0, true),
    mk('Pastel Wedding Cake with Pearls', 'wedding-cakes', 'Two-tier ivory and peach with pink-white-peach fresh roses, carnations and delicate pearl detailing.', 'new', 3999, 0, false),
    mk('White & Red Ribbon Wedding Cake', 'wedding-cakes', 'Two-tier white with red daisy fondant flowers, red satin ribbon, oversized red bow and classic bride-groom topper.', 'bestseller', 4499, 0, true),
    mk('Red Velvet Hearts Romantic Cake', 'wedding-cakes', 'Single tier with red velvet ganache drip, oversized red heart topper, heart sprinkles and red velvet crumb at the base.', 'new', 2499, 0, false),
    mk('Pink Princess Engagement Couple Cake', 'wedding-cakes', 'Two-tier ivory with hand-painted princess and groom illustration, cascading pink fondant dress, pink carnations and gold engaged topper.', 'bestseller', 4999, 0, true),
    mk('Royal Pink Ring Box Cake - Two Tier', 'engagement-cakes', 'Stunning two-tier engagement cake — pink hexagonal ring box with two gold rings on top, gold ornamental medallion on the white base and hand-crafted blush fondant roses.', 'bestseller', 4499, 0, true),
    mk('Forever Couple Silhouette Cake', 'engagement-cakes', 'Two-tier blush fondant with hand-cut bride and groom silhouette, gold heart-with-ring topper, fresh roses and pearl detailing.', 'bestseller', 4999, 0, true),
    mk('Pearl & Hearts Engagement Cake', 'engagement-cakes', 'Tall single tier finished with delicate hand-piped pearls, red heart accents, double-ring topper and fresh white roses.', 'new', 2999, 0, false),
    mk('Red Velvet Roses Engagement Cake', 'engagement-cakes', 'Romantic two-tier with red velvet crown on top, fresh red roses cascading down and twin diamond-ring toppers.', 'bestseller', 2799, 10, false),
    mk('Jungle Theme with Animals Two-Tier Cake', 'baby-shower-cakes', 'Lush green two-tier with lion, zebra, elephant and leopard fondant figurines under monstera leaves — perfect wild one celebration.', 'bestseller', 5999, 0, true),
    mk('Rainbow Unicorn Birthday Cake for Girl', 'baby-shower-cakes', 'Pastel pink and blue ombre with a magical rainbow unicorn topper, gold stars, clouds and edible flower confetti.', 'bestseller', 2999, 0, true),
    mk('Winged Baby Unicorn Hearts Cake', 'baby-shower-cakes', 'Sky-blue tier with a baby pegasus topper, pastel hearts, gold stars on sticks and dreamy cloud detailing.', 'new', 2999, 0, false),
    mk('Half Birthday Teddy Cake', 'half-year-birthday-cakes', 'Mint blue cake with two adorable brown teddies, halfway to one star sign and a ladder — the perfect 6 month milestone.', 'bestseller', 1999, 0, true),
    mk('Barbie Doll Pink Floral Cake', 'baby-shower-cakes', 'Classic Barbie doll cake in a flowing pink fondant gown with white floral detailing — a princess birthday showstopper.', 'bestseller', 2999, 0, false),
    mk('Pastel Rainbow Bear Cake for Kids', 'baby-shower-cakes', 'Pastel pink, yellow, mint and blue rainbow ombre with two adorable teddy bears, fluffy clouds and rainbow topper — pure cuteness.', 'bestseller', 2499, 0, true),
    mk('Personalised Name 1st Birthday Princess Cake', 'baby-shower-cakes', 'Premium two-tier with a princess doll in pink ruffles, white bunny, custom-piped name, gold 1 number and rose-gold metallic spheres.', 'bestseller', 4999, 0, true),
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, category, tag, description, mrp, discount, images, variant_groups, prep_hours, slug, featured, active)
    VALUES (@id, @name, @category, @tag, @description, @mrp, @discount, @images, @variant_groups, @prep_hours, @slug, @featured, @active)
  `);

  const migrate = db.transaction((items) => {
    db.prepare('DELETE FROM products').run();
    for (const item of items) insertProduct.run(item);
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run('catalog_seeded_v1', 'true');
  });
  migrate(catalog);
  console.log(`✓ Seeded real product catalog (${catalog.length} products) — one-time migration complete`);
}

// ── One-time seed: the add-on upsell items that used to be hardcoded in
//    js/shop.js (icons only, no admin control). Seeded once so the team can
//    take over managing them (photos, price, which categories they show
//    for, active/inactive) from admin instead of a code change.
const alreadySeededAddons = db.prepare('SELECT value FROM settings WHERE key = ?').get('addons_seeded_v1');
if (!alreadySeededAddons) {
  const mkAddon = (id, name, price, unit, categories) => ({
    id, name, price, unit,
    image: '',
    categories: JSON.stringify(categories),
    active: 1,
  });
  const addonSeed = [
    mkAddon('bday-caps',      'Birthday Caps',             49,  'per cap',    []),
    mkAddon('num-candles',    'Number Candles',            29,  'per number', []),
    mkAddon('themed-candles', 'Themed Candle Set',         99,  'set of 10',  []),
    mkAddon('bday-banner',    'Happy Bday Banner',         149, 'each',       []),
    mkAddon('balloons',       'Metallic Balloons',         49,  '5 balloons', []),
    mkAddon('horn-blowers',   'Party Horn Blowers',        79,  'set of 6',   []),
    mkAddon('flower-ring',    'Fresh Flower Ring',         299, 'each',       ['wedding-cakes', 'engagement-cakes']),
    mkAddon('cake-knife',     'Cake Knife & Server Set',   399, 'set',        ['wedding-cakes', 'engagement-cakes']),
    mkAddon('ribbon-deco',    'Ribbon Decoration',         149, 'each',       ['wedding-cakes', 'engagement-cakes']),
    mkAddon('baby-banner',    'Kids Birthday Banner',      149, 'each',       ['baby-shower-cakes']),
    mkAddon('pastel-balloons','Pastel Balloon Bouquet',    199, 'set of 10',  ['baby-shower-cakes']),
    mkAddon('name-topper',    'Custom Name Topper',        249, 'each',       ['baby-shower-cakes']),
  ];
  const insertAddon = db.prepare(`
    INSERT INTO addons (id, name, price, unit, image, categories, active)
    VALUES (@id, @name, @price, @unit, @image, @categories, @active)
  `);
  const migrateAddons = db.transaction((items) => {
    for (const item of items) insertAddon.run(item);
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run('addons_seeded_v1', 'true');
  });
  migrateAddons(addonSeed);
  console.log(`✓ Seeded add-ons (${addonSeed.length}) — one-time migration complete`);
}

// ── One-time seed: real customer ratings collected offline (in-store /
//    WhatsApp orders), matched to catalog products by exact name. Guarded
//    by 'reviews_seeded_v1' so it only ever runs once — later admin-added
//    reviews are never touched or overwritten by this.
const alreadySeededReviews = db.prepare('SELECT value FROM settings WHERE key = ?').get('reviews_seeded_v1');
if (!alreadySeededReviews) {
  let reviewSeed = [];
  try {
    reviewSeed = require('./seed-reviews.json');
  } catch (_) {
    reviewSeed = [];
  }

  if (reviewSeed.length) {
    const insertReview = db.prepare(`
      INSERT INTO reviews (id, product_slug, customer_name, area, geography, rating, review_date)
      VALUES (@id, @productSlug, @customerName, @area, @geography, @rating, @date)
    `);
    const migrateReviews = db.transaction((items) => {
      for (const item of items) insertReview.run(item);
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
        .run('reviews_seeded_v1', 'true');
    });
    migrateReviews(reviewSeed);
    console.log(`✓ Seeded customer ratings (${reviewSeed.length}) — one-time migration complete`);
  }
}

// ── One-time seed: second batch of customer ratings supplied for a specific
//    set of popular products (engagement/wedding/kids-theme cakes), on top
//    of the original 'reviews_seeded_v1' batch above. Guarded separately by
//    'reviews_seeded_v2' so it only ever runs once and won't re-run or
//    collide with v1's guard.
const alreadySeededReviewsV2 = db.prepare('SELECT value FROM settings WHERE key = ?').get('reviews_seeded_v2');
if (!alreadySeededReviewsV2) {
  let reviewSeedV2 = [];
  try {
    reviewSeedV2 = require('./seed-reviews-2.json');
  } catch (_) {
    reviewSeedV2 = [];
  }

  if (reviewSeedV2.length) {
    const insertReviewV2 = db.prepare(`
      INSERT INTO reviews (id, product_slug, customer_name, area, geography, rating, review_date)
      VALUES (@id, @productSlug, @customerName, @area, @geography, @rating, @date)
    `);
    const migrateReviewsV2 = db.transaction((items) => {
      for (const item of items) insertReviewV2.run(item);
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
        .run('reviews_seeded_v2', 'true');
    });
    migrateReviewsV2(reviewSeedV2);
    console.log(`✓ Seeded additional customer ratings (${reviewSeedV2.length}) — one-time migration complete`);
  }
}

// ── One-time cleanup: reviewer names seeded so far mix three styles --
//    "First Last", "First M. Last" (an awkward inserted middle initial),
//    and "First I." -- which look inconsistent side by side on the
//    storefront. Strips any lone single-letter-plus-period token (a
//    middle initial or an initial standing in for a surname) from every
//    existing review's customer_name, leaving either a full "First Last"
//    name or just "First" -- both of which read cleanly. Guarded by
//    'reviews_name_cleanup_v1' so it only ever runs once; reviews added
//    afterward (via admin, or the v2 batch above, which is already clean)
//    are never touched by this again.
const alreadyCleanedReviewNames = db.prepare('SELECT value FROM settings WHERE key = ?').get('reviews_name_cleanup_v1');
if (!alreadyCleanedReviewNames) {
  const messyNames = db.prepare(`SELECT id, customer_name FROM reviews WHERE customer_name LIKE '% _.%' OR customer_name LIKE '% _.'`).all();
  const updateName = db.prepare('UPDATE reviews SET customer_name = ? WHERE id = ?');
  const cleanupNames = db.transaction((rows) => {
    for (const row of rows) {
      const cleaned = row.customer_name
        .split(/\s+/)
        .filter(w => !/^[A-Za-z]\.$/.test(w))
        .join(' ')
        .trim();
      if (cleaned && cleaned !== row.customer_name) updateName.run(cleaned, row.id);
    }
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run('reviews_name_cleanup_v1', 'true');
  });
  cleanupNames(messyNames);
  console.log(`✓ Cleaned up ${messyNames.length} reviewer name(s) — one-time migration complete`);
}

// ── One-time migration: Birthday Theme Cakes category removed (its 6
//    products deleted outright — team's call, not a recategorization) and
//    two new categories introduced. "Half Birthday Teddy Cake" is a real
//    existing product moved from baby-shower-cakes into the new dedicated
//    half-year-birthday-cakes category; gender-reveal-cakes starts empty
//    until real products are added via admin. Guarded by
//    'category_restructure_v1' so it only ever runs once.
const alreadyRestructured = db.prepare('SELECT value FROM settings WHERE key = ?').get('category_restructure_v1');
if (!alreadyRestructured) {
  const restructure = db.transaction(() => {
    db.prepare(`DELETE FROM products WHERE category = 'birthday-theme-cakes'`).run();
    db.prepare(`UPDATE products SET category = 'half-year-birthday-cakes', updated_at = datetime('now') WHERE slug = 'half-birthday-teddy-cake'`).run();
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run('category_restructure_v1', 'true');
  });
  restructure();
  console.log('✓ Category restructure complete — Birthday Theme Cakes removed, Half Year Birthday Cakes seeded');
}

// ── One-time seed: launch catalog for the new Rakhi & Sweets Hampers
//    category. Each product uses two variant groups on the existing
//    variant-pricing system -- "Rakhi Set" (required: how many rakhis) and
//    "Add a Sweet Treat" (optional: which mithai/cake add-on, if any) --
//    exactly the same required+optional variant-group mechanism already
//    used elsewhere (e.g. Ferrero Rocher's Weight + Add-ons), so no schema
//    or checkout changes were needed. Guarded by 'rakhi_hampers_seeded_v1'
//    so it only ever runs once and never re-runs over admin-edited data.
const alreadySeededRakhi = db.prepare('SELECT value FROM settings WHERE key = ?').get('rakhi_hampers_seeded_v1');
if (!alreadySeededRakhi) {
  const rakhiProducts = [
    {
      name: 'Classic Rakhi & Sweets Hamper',
      tag: 'bestseller',
      description: 'A traditional rakhi paired with your choice of motichoor laddu, kaju katli or an assorted mithai box — the simple, classic way to celebrate Raksha Bandhan.',
      variantGroups: [
        { name: 'Rakhi Set', optional: false, options: [
          { label: 'Single Rakhi', price: 149 },
          { label: 'Bhaiya-Bhabhi Set (2)', price: 249 },
          { label: 'Family Set (4)', price: 399 },
        ]},
        { name: 'Add a Sweet Treat', optional: true, options: [
          { label: 'Motichoor Laddu (250g)', price: 249 },
          { label: 'Kaju Katli (250g)', price: 349 },
          { label: 'Assorted Mithai Box (500g)', price: 549 },
        ]},
      ],
    },
    {
      name: 'Meenakari Rakhi & Kaju Katli Hamper',
      tag: 'new',
      description: 'Elegant meenakari-work rakhi with a box of pure kaju katli — a premium pick for a special Raksha Bandhan.',
      variantGroups: [
        { name: 'Rakhi Set', optional: false, options: [
          { label: 'Single Meenakari Rakhi', price: 249 },
          { label: 'Bhaiya-Bhabhi Meenakari Set (2)', price: 399 },
        ]},
        { name: 'Add a Sweet Treat', optional: true, options: [
          { label: 'Kaju Katli (250g)', price: 349 },
          { label: 'Kaju Katli (500g)', price: 649 },
          { label: 'Assorted Mithai Box (500g)', price: 549 },
        ]},
      ],
    },
    {
      name: 'Kids Rakhi & Chocolate Treat Box',
      tag: null,
      description: 'A fun cartoon-character rakhi for your little brother, paired with a box of chocolate treats or mini cupcakes he’ll actually be excited about.',
      variantGroups: [
        { name: 'Rakhi Set', optional: false, options: [
          { label: 'Single Kids Rakhi', price: 99 },
          { label: 'Set of 2 Kids Rakhis', price: 179 },
        ]},
        { name: 'Add a Sweet Treat', optional: true, options: [
          { label: 'Chocolate Truffle Bites (200g)', price: 299 },
          { label: 'Mini Cupcakes (Box of 4)', price: 399 },
        ]},
      ],
    },
    {
      name: 'Family Rakhi & Mithai Celebration Hamper',
      tag: 'bestseller',
      description: 'A generous set of rakhis for the whole family with a curated mithai or dry fruit box — built for the big Raksha Bandhan get-together.',
      variantGroups: [
        { name: 'Rakhi Set', optional: false, options: [
          { label: 'Family Set (4)', price: 399 },
          { label: 'Extended Family Set (6)', price: 549 },
        ]},
        { name: 'Add a Sweet Treat', optional: true, options: [
          { label: 'Assorted Mithai Box (500g)', price: 549 },
          { label: 'Assorted Mithai Box (1kg)', price: 999 },
          { label: 'Dry Fruit Box (500g)', price: 799 },
        ]},
      ],
    },
  ];

  const insertRakhi = db.prepare(`
    INSERT INTO products (id, name, category, tag, description, mrp, discount, images, variant_groups, prep_hours, slug, featured, trending, active)
    VALUES (@id, @name, 'rakhi-hampers', @tag, @description, 0, 0, '[]', @variant_groups, 0, @slug, @featured, 0, 1)
  `);
  const seedRakhi = db.transaction((items) => {
    items.forEach((p, i) => {
      const slug = slugify(p.name);
      insertRakhi.run({
        id: 'p_' + slug,
        name: p.name,
        tag: p.tag,
        description: p.description,
        variant_groups: JSON.stringify(p.variantGroups),
        slug,
        featured: i === 0 ? 1 : 0,
      });
    });
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run('rakhi_hampers_seeded_v1', 'true');
  });
  seedRakhi(rakhiProducts);
  console.log(`✓ Seeded Rakhi & Sweets Hampers catalog (${rakhiProducts.length} products) — one-time migration complete`);
}

module.exports = db;
