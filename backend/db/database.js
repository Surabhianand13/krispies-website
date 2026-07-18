'use strict';

const path    = require('path');
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
    phone         TEXT    NOT NULL UNIQUE,
    email         TEXT,
    password_hash TEXT    NOT NULL,
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
`);

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
safeAddColumn('orders',   'customer_email', 'TEXT');
safeAddColumn('orders',   'payment_method', 'TEXT');
safeAddColumn('orders',   'customer_id',    'TEXT');
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug)'); } catch (_) {}
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)'); } catch (_) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_addresses_customer ON addresses(customer_id)'); } catch (_) {}

// ── Seed admin user ────────────────────────────────────────────────────────────
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  const password = process.env.ADMIN_PASSWORD || 'krispies2024';
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
    mk('Unicorn Magic', 'birthday-theme-cakes', 'Pastel rainbow swirls, edible glitter horn, and fairy dust sprinkles.', 'bestseller', 1599, 10, true),
    mk('Dinosaur Roar', 'birthday-theme-cakes', 'T-Rex and friends in sculpted fondant — perfect for little explorers.', 'bestseller', 1699, 0, true),
    mk('Princess Castle', 'birthday-theme-cakes', 'Dream castle with sugar turrets, fondant flowers and a princess topper.', 'custom', 2199, 0, false),
    mk('Superhero Action Cake', 'birthday-theme-cakes', "Your child's favourite hero in 3D fondant on a bright sponge.", 'bestseller', 1799, 10, false),
    mk('Galaxy Space Cake', 'birthday-theme-cakes', 'Deep space swirls in airbrushed purple and blue with sugar stars.', 'new', 1899, 0, false),
    mk('Safari Animals Cake', 'birthday-theme-cakes', 'Jungle animals peeking from a fondant-wrapped cake.', 'custom', 1599, 0, false),
    mk('Jungle Theme with Animals Two-Tier Cake', 'baby-shower-cakes', 'Lush green two-tier with lion, zebra, elephant and leopard fondant figurines under monstera leaves — perfect wild one celebration.', 'bestseller', 5999, 0, true),
    mk('Rainbow Unicorn Birthday Cake for Girl', 'baby-shower-cakes', 'Pastel pink and blue ombre with a magical rainbow unicorn topper, gold stars, clouds and edible flower confetti.', 'bestseller', 2999, 0, true),
    mk('Winged Baby Unicorn Hearts Cake', 'baby-shower-cakes', 'Sky-blue tier with a baby pegasus topper, pastel hearts, gold stars on sticks and dreamy cloud detailing.', 'new', 2999, 0, false),
    mk('Half Birthday Teddy Cake', 'baby-shower-cakes', 'Mint blue cake with two adorable brown teddies, halfway to one star sign and a ladder — the perfect 6 month milestone.', 'bestseller', 1999, 0, true),
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

module.exports = db;
