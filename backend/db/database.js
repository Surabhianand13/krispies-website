'use strict';

const path    = require('path');
const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'krispies.db');
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
    id          TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    category    TEXT    NOT NULL,
    tag         TEXT,
    description TEXT    NOT NULL,
    featured    INTEGER NOT NULL DEFAULT 0,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id              TEXT    PRIMARY KEY,
    customer_name   TEXT    NOT NULL,
    customer_phone  TEXT,
    items           TEXT    NOT NULL,
    quantity        TEXT,
    amount          REAL,
    platform        TEXT,
    outlet          TEXT,
    order_date      TEXT,
    delivery_date   TEXT,
    status          TEXT    NOT NULL DEFAULT 'pending',
    notes           TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
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
`);

// ── Migrate: add pricing + images columns if missing ──────────────────────────
try { db.exec("ALTER TABLE products ADD COLUMN mrp INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE products ADD COLUMN discount INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE products ADD COLUMN images TEXT NOT NULL DEFAULT '[]'"); } catch {}

// ── Seed admin user ────────────────────────────────────────────────────────────
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  const password = process.env.ADMIN_PASSWORD || 'krispies2024';
  const hash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', hash);
  console.log('✓ Admin user created');
}

// ── Seed default products ──────────────────────────────────────────────────────
const productCount = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
if (productCount === 0) {
  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, category, tag, description, featured, active, mrp, discount, images)
    VALUES (@id, @name, @category, @tag, @description, @featured, @active, @mrp, @discount, @images)
  `);

  const defaults = [
    // Birthday Cakes
    { id: 'p7',  name: 'Classic Vanilla Dream',      category: 'birthday-cakes',   tag: 'bestseller', description: 'Moist vanilla sponge layered with silky buttercream — a timeless favourite loved by every generation.',                 featured: 1, active: 1, mrp: 899,   discount: 10, images: '[]' },
    { id: 'p8',  name: 'Chocolate Overload',         category: 'birthday-cakes',   tag: 'bestseller', description: 'Dark chocolate sponge, ganache drip, and chocolate shards for the ultimate chocoholic celebration.',                    featured: 1, active: 1, mrp: 999,   discount: 15, images: '[]' },
    { id: 'p9',  name: 'Red Velvet Royale',          category: 'birthday-cakes',   tag: 'bestseller', description: 'Striking red velvet layers with luscious cream cheese frosting — dramatic, decadent, and unforgettable.',               featured: 1, active: 1, mrp: 1099,  discount: 10, images: '[]' },
    { id: 'p10', name: 'Black Forest Bliss',         category: 'birthday-cakes',   tag: 'bestseller', description: 'Classic Black Forest with cherries, whipped cream and dark chocolate — a heritage recipe baked fresh.',                 featured: 0, active: 1, mrp: 999,   discount: 0,  images: '[]' },
    { id: 'p11', name: 'Fruit Fiesta',               category: 'birthday-cakes',   tag: 'new',        description: 'Fresh seasonal fruits, light chantilly cream, and a vanilla sponge — refreshing, vibrant and beautiful.',               featured: 0, active: 1, mrp: 849,   discount: 0,  images: '[]' },
    { id: 'p12', name: 'Theme Cakes',                category: 'birthday-cakes',   tag: 'custom',     description: 'Superheroes, unicorns, sports, movies — any theme your heart desires, sculpted in cake form.',                          featured: 0, active: 1, mrp: 1499,  discount: 0,  images: '[]' },
    // Customized Cakes
    { id: 'p1',  name: 'Photo-Print Cake',           category: 'customized-cakes', tag: 'bestseller', description: 'Edible photo print on a moist sponge — any image, any occasion. Truly personal.',                                       featured: 1, active: 1, mrp: 1299,  discount: 10, images: '[]' },
    { id: 'p2',  name: 'Floral Fondant Cake',        category: 'customized-cakes', tag: 'custom',     description: 'Hand-sculpted fondant blooms in your choice of colours — a showstopper for any celebration.',                           featured: 1, active: 1, mrp: 2499,  discount: 0,  images: '[]' },
    { id: 'p3',  name: 'Geode Crystal Cake',         category: 'customized-cakes', tag: 'new',        description: 'Rock-candy geode inlaid in rich buttercream — a true showstopper.',                                                     featured: 0, active: 1, mrp: 2999,  discount: 0,  images: '[]' },
    { id: 'p4',  name: 'Name-Script Cake',           category: 'customized-cakes', tag: null,         description: 'Elegant piped lettering over velvet ganache. Simple and stunning.',                                                     featured: 0, active: 1, mrp: 1199,  discount: 15, images: '[]' },
    { id: 'p5',  name: 'Baby Shower Cake',           category: 'customized-cakes', tag: 'custom',     description: 'Adorable, whimsical cakes to welcome the newest family member. Gender reveal options available.',                       featured: 0, active: 1, mrp: 1499,  discount: 0,  images: '[]' },
    { id: 'p6',  name: 'Character Theme Cake',       category: 'customized-cakes', tag: 'custom',     description: 'Kids\' favourite characters in 3-D fondant. Pure joy, guaranteed.',                                                    featured: 0, active: 1, mrp: 1799,  discount: 0,  images: '[]' },
    // Wedding Cakes
    { id: 'p13', name: 'Classic 2-Tier White',       category: 'wedding-cakes',    tag: 'bestseller', description: 'Elegant two-tier vanilla sponge with smooth white fondant and pearl details. Timeless bridal beauty.',                  featured: 1, active: 1, mrp: 7500,  discount: 10, images: '[]' },
    { id: 'p14', name: 'Floral 3-Tier Fondant',      category: 'wedding-cakes',    tag: 'custom',     description: 'Three tiers of moist sponge draped in ivory fondant with hand-sculpted sugar flowers.',                                featured: 1, active: 1, mrp: 14000, discount: 0,  images: '[]' },
    { id: 'p15', name: 'Rustic Naked Cake',          category: 'wedding-cakes',    tag: 'new',        description: 'Semi-naked layered cake with fresh florals and berries — bohemian, warm, and utterly beautiful.',                       featured: 0, active: 1, mrp: 8500,  discount: 10, images: '[]' },
    { id: 'p16', name: 'Gold Leaf Luxury Tier',      category: 'wedding-cakes',    tag: 'custom',     description: 'Glamorous metallic gold fondant with real edible gold leaf. For the grandest of weddings.',                             featured: 0, active: 1, mrp: 18000, discount: 0,  images: '[]' },
    { id: 'p17', name: 'Minimalist Modern Tier',     category: 'wedding-cakes',    tag: 'new',        description: 'Clean geometric lines, matte fondant, and a single accent bloom — contemporary elegance.',                              featured: 0, active: 1, mrp: 9500,  discount: 0,  images: '[]' },
    // Engagement Cakes
    { id: 'p18', name: 'Ring Box Cake',              category: 'engagement-cakes', tag: 'bestseller', description: 'A showstopping ring-box sculpture cake — the perfect surprise for the big moment.',                                     featured: 1, active: 1, mrp: 2999,  discount: 10, images: '[]' },
    { id: 'p19', name: 'Heart & Roses Cake',         category: 'engagement-cakes', tag: 'bestseller', description: 'Two-tier heart-shaped cake adorned with handmade fondant roses in your wedding colours.',                              featured: 1, active: 1, mrp: 3500,  discount: 0,  images: '[]' },
    { id: 'p20', name: 'Gold Drip Engagement',       category: 'engagement-cakes', tag: 'new',        description: 'Smooth ganache with a luxurious gold drip finish and personalised topper.',                                            featured: 0, active: 1, mrp: 2499,  discount: 15, images: '[]' },
    { id: 'p21', name: 'Photo Collage Tier',         category: 'engagement-cakes', tag: 'custom',     description: 'Edible photo prints of your favourite couple moments, beautifully tier-stacked.',                                      featured: 0, active: 1, mrp: 3999,  discount: 0,  images: '[]' },
    { id: 'p22', name: 'Floral Wreath Cake',         category: 'engagement-cakes', tag: null,         description: 'Buttercream painted floral wreath on a semi-naked cake — romantic and whimsical.',                                     featured: 0, active: 1, mrp: 2799,  discount: 10, images: '[]' },
    // Cheesecakes
    { id: 'p23', name: 'New York Classic',           category: 'cheesecakes',      tag: 'bestseller', description: 'Dense, creamy, perfectly set baked cheesecake on a buttery graham cracker crust.',                                     featured: 1, active: 1, mrp: 699,   discount: 0,  images: '[]' },
    { id: 'p24', name: 'Blueberry Cheesecake',       category: 'cheesecakes',      tag: 'bestseller', description: 'Classic cheesecake crowned with a vibrant, tangy blueberry compote.',                                                 featured: 1, active: 1, mrp: 749,   discount: 10, images: '[]' },
    { id: 'p25', name: 'Mango Cheesecake',           category: 'cheesecakes',      tag: 'seasonal',   description: 'Tropical Alphonso mango atop a light cream cheese base — summer celebrations perfected.',                              featured: 0, active: 1, mrp: 749,   discount: 0,  images: '[]' },
    { id: 'p26', name: 'Oreo Cheesecake',            category: 'cheesecakes',      tag: 'new',        description: 'Creamy cheesecake with Oreo crust, chunks throughout, and crushed Oreo topping.',                                     featured: 0, active: 1, mrp: 799,   discount: 0,  images: '[]' },
    { id: 'p27', name: 'Lotus Biscoff',              category: 'cheesecakes',      tag: 'bestseller', description: 'Velvety no-bake cheesecake with Biscoff spread and crushed caramel cookies.',                                          featured: 0, active: 1, mrp: 849,   discount: 0,  images: '[]' },
    // Donuts
    { id: 'p28', name: 'Glazed Original',            category: 'donuts',           tag: null,         description: 'The classic — perfectly yeasted donut ring with a sheer vanilla glaze. Simple. Perfect. Timeless.',                    featured: 1, active: 1, mrp: 99,    discount: 0,  images: '[]' },
    { id: 'p29', name: 'Chocolate Frosted',          category: 'donuts',           tag: 'bestseller', description: 'Rich dark chocolate ganache on a fluffy donut.',                                                                       featured: 1, active: 1, mrp: 119,   discount: 0,  images: '[]' },
    { id: 'p30', name: 'Strawberry Sprinkle',        category: 'donuts',           tag: 'bestseller', description: 'Pink strawberry glaze showered with rainbow sprinkles — fun, colourful, and guaranteed to make you smile.',            featured: 0, active: 1, mrp: 119,   discount: 0,  images: '[]' },
    { id: 'p31', name: 'Caramel Crunch',             category: 'donuts',           tag: 'new',        description: 'Buttery caramel glaze with caramelized sugar crystals — indulgent, golden, extraordinary.',                            featured: 0, active: 1, mrp: 129,   discount: 0,  images: '[]' },
    { id: 'p32', name: 'Cinnamon Sugar',             category: 'donuts',           tag: null,         description: 'Warm cinnamon and sugar coating on a soft fried donut — a bakery classic that never goes out of style.',               featured: 0, active: 1, mrp: 99,    discount: 0,  images: '[]' },
  ];

  const insertMany = db.transaction((items) => {
    for (const item of items) insertProduct.run(item);
  });
  insertMany(defaults);
  console.log(`✓ Seeded ${defaults.length} default products`);
}

module.exports = db;
