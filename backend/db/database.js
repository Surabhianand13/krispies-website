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
    INSERT INTO products (id, name, category, tag, description, featured, active)
    VALUES (@id, @name, @category, @tag, @description, @featured, @active)
  `);

  const defaults = [
    // Customized Cakes
    { id: 'p1',  name: 'Photo-Print Cake',          category: 'customized-cakes', tag: 'bestseller', description: 'Edible photo print on a moist sponge — any image, any occasion.', featured: 1, active: 1 },
    { id: 'p2',  name: 'Floral Fondant Cake',        category: 'customized-cakes', tag: 'custom',     description: 'Hand-sculpted fondant blooms in your choice of colours.', featured: 1, active: 1 },
    { id: 'p3',  name: 'Name-Script Cake',           category: 'customized-cakes', tag: null,         description: 'Elegant piped lettering over velvet ganache. Simple & stunning.', featured: 0, active: 1 },
    { id: 'p4',  name: 'Geode Crystal Cake',         category: 'customized-cakes', tag: 'new',        description: 'Rock-candy geode inlaid in rich buttercream. A show stopper.', featured: 0, active: 1 },
    { id: 'p5',  name: 'Tier Wedding Cake',          category: 'customized-cakes', tag: 'custom',     description: '3-tier heirloom design. Lace, flowers, or minimalist — your call.', featured: 0, active: 1 },
    { id: 'p6',  name: 'Character Theme Cake',       category: 'customized-cakes', tag: null,         description: 'Kids\' favourite characters in 3-D fondant. Pure joy, guaranteed.', featured: 0, active: 1 },
    // Birthday Cakes
    { id: 'p7',  name: 'Chocolate Truffle',          category: 'birthday-cakes',   tag: 'bestseller', description: 'Layers of dark chocolate ganache & moist sponge. The classic.', featured: 1, active: 1 },
    { id: 'p8',  name: 'Black Forest',               category: 'birthday-cakes',   tag: null,         description: 'Cherries, chantilly cream & dark chocolate shavings on every slice.', featured: 0, active: 1 },
    { id: 'p9',  name: 'Mango Mousse Cake',          category: 'birthday-cakes',   tag: 'seasonal',   description: 'Fresh Alphonso mango mousse on a buttery sponge — summer special.', featured: 0, active: 1 },
    { id: 'p10', name: 'Butterscotch Dream',         category: 'birthday-cakes',   tag: null,         description: 'Crunchy butterscotch praline layered in creamy buttercream.', featured: 0, active: 1 },
    { id: 'p11', name: 'Strawberry Shortcake',       category: 'birthday-cakes',   tag: 'new',        description: 'Fresh strawberries folded into lightly sweetened whipped cream.', featured: 0, active: 1 },
    { id: 'p12', name: 'Rainbow Funfetti',           category: 'birthday-cakes',   tag: null,         description: 'Colourful sprinkles baked right in. A party inside a cake!', featured: 0, active: 1 },
    // Biscuits
    { id: 'p13', name: 'Nankhatai',                  category: 'biscuits',         tag: 'bestseller', description: 'Our 30-year-old Iyengar recipe. Cardamom ghee shortbread at its finest.', featured: 1, active: 1 },
    { id: 'p14', name: 'Coconut Cookies',            category: 'biscuits',         tag: null,         description: 'Toasted desiccated coconut in a crisp golden cookie.', featured: 0, active: 1 },
    { id: 'p15', name: 'Chocolate Chip Cookies',     category: 'biscuits',         tag: 'new',        description: 'Gooey centres, crisp edges. Packed with Belgian chocolate chips.', featured: 0, active: 1 },
    { id: 'p16', name: 'Butter Biscuits',            category: 'biscuits',         tag: null,         description: 'Pure butter, a touch of vanilla — melt-in-the-mouth perfection.', featured: 0, active: 1 },
    { id: 'p17', name: 'Jeera (Cumin) Cookies',      category: 'biscuits',         tag: null,         description: 'Savoury-sweet cumin biscuits — a uniquely Indian snack.', featured: 0, active: 1 },
    { id: 'p18', name: 'Tutti Frutti Cake Rusk',     category: 'biscuits',         tag: 'bestseller', description: 'Double-baked sponge rusk loaded with tutti frutti gems.', featured: 0, active: 1 },
    // Cheesecakes
    { id: 'p19', name: 'Classic New York',           category: 'cheesecakes',      tag: 'bestseller', description: 'Dense, creamy, no-nonsense New York cheesecake on a graham crust.', featured: 1, active: 1 },
    { id: 'p20', name: 'Blueberry Swirl',            category: 'cheesecakes',      tag: null,         description: 'Wild blueberry compote ribboned through silky cream cheese.', featured: 0, active: 1 },
    { id: 'p21', name: 'Mango Cheesecake',           category: 'cheesecakes',      tag: 'seasonal',   description: 'No-bake Alphonso mango cheesecake — light, tropical, irresistible.', featured: 0, active: 1 },
    { id: 'p22', name: 'Lotus Biscoff',              category: 'cheesecakes',      tag: 'new',        description: 'Biscoff cookie base with a caramelised spread swirl. Utterly addictive.', featured: 0, active: 1 },
    // Donuts
    { id: 'p23', name: 'Glazed Classic',             category: 'donuts',           tag: null,         description: 'The OG — fluffy yeast donut with a shiny sugar glaze.', featured: 0, active: 1 },
    { id: 'p24', name: 'Choco Overload Donut',       category: 'donuts',           tag: 'bestseller', description: 'Triple chocolate: dough, glaze & chocolate chip topping.', featured: 1, active: 1 },
    { id: 'p25', name: 'Strawberry Sprinkle Donut',  category: 'donuts',           tag: null,         description: 'Pink strawberry glaze with rainbow sprinkles. Cheerful & delicious.', featured: 0, active: 1 },
  ];

  const insertMany = db.transaction((items) => {
    for (const item of items) insertProduct.run(item);
  });
  insertMany(defaults);
  console.log(`✓ Seeded ${defaults.length} default products`);
}

module.exports = db;
