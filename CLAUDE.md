# Krispie's Website — Full Project Documentation

> **Live site:** [www.krispies.in](https://www.krispies.in)  
> **Admin panel:** [www.krispies.in/admin/](https://www.krispies.in/admin/)  
> **Backend (Render):** Connect your Render URL — currently `http://localhost:3000` placeholder in `js/main.js`  
> **Stack:** Plain HTML/CSS/JS frontend · Node.js + Express + SQLite backend · Vercel (frontend) · Render (backend)

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Frontend Pages](#2-frontend-pages)
3. [CSS Design System](#3-css-design-system)
4. [JavaScript — main.js](#4-javascript--mainjs)
5. [Menu Page & Dynamic Products](#5-menu-page--dynamic-products)
6. [Buy Now Checkout Flow](#6-buy-now-checkout-flow)
7. [Admin Panel](#7-admin-panel)
8. [Backend API](#8-backend-api)
9. [Database Schema](#9-database-schema)
10. [Environment Variables](#10-environment-variables)
11. [Deployment](#11-deployment)
12. [Razorpay Integration](#12-razorpay-integration)
13. [How to Make Common Changes](#13-how-to-make-common-changes)
14. [Known Issues & Gotchas](#14-known-issues--gotchas)
15. [Pending / Future Work](#15-pending--future-work)

---

## 1. Project Structure

```
krispies-website/
│
├── index.html              ← Homepage (hero carousel, featured products, CTA)
├── menu.html               ← Menu hub (category cards; product grids live on category pages)
├── birthday-cakes.html     ← Category landing page (+ wedding/engagement/birthday-theme/baby-shower-cakes.html)
├── product.html            ← Individual product detail page (?slug=<slug>)
├── story.html              ← Our Story / brand history
├── contact.html            ← Contact form (posts to backend API)
│
├── articles/
│   ├── index.html                      ← Articles listing page
│   ├── perfect-birthday-cake.html
│   ├── customized-cakes-guide.html
│   └── iyengar-baking-heritage.html
│
├── admin/
│   ├── index.html          ← Admin login page
│   ├── dashboard.html      ← Stats overview
│   ├── products.html       ← Add / Edit / Delete products
│   ├── enquiries.html      ← View contact form submissions
│   ├── orders.html         ← View & manage orders
│   ├── admin.css           ← Admin-only styles
│   └── admin.js            ← Shared admin utilities (auth, localStorage, helpers)
│
├── css/
│   └── styles.css          ← Single brand stylesheet (all pages)
│
├── js/
│   ├── main.js             ← Shared frontend JS (nav, hero carousel, BACKEND_URL, contact form)
│   ├── shop.js             ← Shared products/cart/checkout — loaded by menu.html, all 5 category
│   │                          pages, and product.html. Fetches products from the backend API.
│   └── product-detail.js   ← product.html-specific rendering (gallery, variant picker)
│
├── assets/
│   └── logo.png            ← Brand logo
│
└── backend/
    ├── server.js           ← Express app entry point
    ├── package.json
    ├── .env                ← Secrets (never commit this)
    ├── .env.example        ← Template for env vars
    ├── db/
    │   └── database.js     ← SQLite setup, table creation, seeding
    ├── middleware/
    │   └── auth.js         ← JWT verification middleware
    ├── utils/
    │   └── email.js        ← Nodemailer email templates
    └── routes/
        ├── auth.js         ← POST /api/auth/login
        ├── products.js     ← CRUD for products (auth required)
        ├── orders.js       ← CRUD for orders (auth required)
        ├── messages.js     ← Contact form messages (POST is public)
        └── checkout.js     ← Buy Now orders + Razorpay (all public)
```

---

## 2. Frontend Pages

### `index.html` — Homepage

- **Navigation** — always dark background (`rgba(10,10,10,0.88)`), gold fonts. Same on all pages.
- **Hero Carousel** — 5 slides, auto-advances every 5 s. Each slide has:
  - Left: heading, subheading, two CTA buttons
  - Right: `<div class="hero__art">` — replace emoji with `<img>` to add real photos
  - Background: `.hero__slide-bg` — add `style="background-image:url('...')"` for bg images
  - Controls: prev/next arrows + dot indicators + touch swipe + keyboard arrows
- **Featured Products** section — reads from `localStorage['krispies_products']`, shows items with `featured: true`
- **Order CTA** — Zomato / Swiggy links

**To change carousel slides:** Edit the `.hero__slide` blocks in `index.html`. Each slide is a self-contained `<div class="hero__slide">` block. Copy/delete to add/remove slides.

**To add a real image to a slide:**
```html
<!-- Replace the emoji circle: -->
<div class="hero__art">🎂</div>
<!-- With: -->
<img class="hero__art" src="assets/slide1.jpg" alt="Birthday Cake">

<!-- Add background: give the .hero__slide-bg a style: -->
<div class="hero__slide-bg" style="background-image:url('assets/slide1-bg.jpg')"></div>
```

---

### `menu.html` — Menu Page

Fully dynamic — reads all products from `localStorage['krispies_products']`.  
See [Section 5](#5-menu-page--dynamic-products) for full details.

---

### `contact.html` — Contact Form

Submits to `BACKEND_URL/api/messages` via `fetch()`. On failure, falls back to saving in `localStorage['krispies_enquiries']` so the admin panel can still see it.

**Fields:** Name, Phone, Email, Event Type, Outlet preference, Event Date, Products interested in, Message.

---

### `story.html` — Our Story

Static page. Brand history, founding story (1996, Iyengar baking heritage), values.

---

### `articles/` — Blog Articles

Static articles. Three articles exist:
1. `perfect-birthday-cake.html`
2. `customized-cakes-guide.html`
3. `iyengar-baking-heritage.html`

---

## 3. CSS Design System

**File:** `css/styles.css` (single file for all public pages)

### CSS Variables (`:root`)

```css
--black:       #0A0A0A    /* page background */
--black-2:     #111111
--black-3:     #1A1A1A    /* card backgrounds */
--black-4:     #222222    /* input backgrounds */
--gold:        #C9A870    /* primary brand accent */
--gold-light:  #E5CFA0
--gold-faint:  rgba(201, 168, 112, 0.12)
--gold-dark:   #9A7A48
--cream:       #FAF7F0
--cream-2:     #F0E8D5
--border-gold: rgba(201, 168, 112, 0.28)
--shadow-gold: 0 8px 40px rgba(201, 168, 112, 0.18)

--text-on-dark:  #E8D9C0   /* text on dark backgrounds */
--text-muted:    rgba(232, 217, 192, 0.55)
--text-on-light: #1A1208   /* text on light backgrounds */
--text-muted-lt: #6B5B3E

--font-display: 'Playfair Display', Georgia, serif
--font-body:    'Inter', -apple-system, sans-serif

--nav-h:   90px   /* nav height — used for scroll offsets */
```

### Key Component Classes

| Class | What it does |
|-------|-------------|
| `.btn` | Base button |
| `.btn-gold` | Gold filled button (primary CTA) |
| `.btn-outline` | Transparent with gold border |
| `.btn-zomato` | Red Zomato button |
| `.btn-swiggy` | Orange Swiggy button |
| `.section-label` | Small uppercase gold label above headings |
| `.gold-line` | Gold horizontal decorative rule |
| `.fade-up` | IntersectionObserver scroll-in animation |
| `.pcard` | Product card |
| `.pcard__gallery` | Image gallery with swipe |
| `.pcard__tag-badge` | Tag badge (bestseller / new / seasonal / custom) |
| `.menu-tabs` | Sticky horizontal category tab bar |
| `.cant-find-cta` | "Can't find what you're looking for?" section |
| `.checkout-overlay` | Full-page checkout modal overlay |
| `.checkout-modal` | 3-step checkout modal |

### Nav Behaviour

The nav is **always dark** regardless of scroll position:
```css
.nav { background: rgba(10,10,10,0.88); }
.nav__links a { color: var(--text-muted); }
.nav__links a:hover, .nav__links a.active { color: var(--gold); }
```

---

## 4. JavaScript — `main.js`

**Loaded on every public page** via `<script src="js/main.js"></script>`.

### Key responsibilities

1. **Nav scroll class** — adds `.scrolled` to `.nav` when `window.scrollY > 60`
2. **Hamburger menu** — mobile nav open/close with animated ×
3. **Hero Carousel IIFE** — 5-slide autoplay, arrows, dots, touch swipe, keyboard

### `BACKEND_URL` constant

```js
const BACKEND_URL = 'http://localhost:3000';
```

⚠️ **This must be updated to your Render URL when you deploy the backend.** This constant is shared across all pages — update it in one place and everywhere works.

```js
// Change to your Render URL, e.g.:
const BACKEND_URL = 'https://krispies-backend.onrender.com';
```

### Contact form

In `contact.html` — POSTs to `${BACKEND_URL}/api/messages`. Falls back to localStorage on network error.

---

## 5. Menu Page, Category Pages & Dynamic Products

### How it works

The **backend API is the single source of truth** for products — `menu.html`, the category
landing pages (`birthday-cakes.html`, `wedding-cakes.html`, `engagement-cakes.html`,
`baby-shower-cakes.html`, `half-year-birthday-cakes.html`, `gender-reveal-cakes.html`, etc.),
and `product.html` all share one file,
**`js/shop.js`**, instead of each carrying their own copy of the product/cart/checkout logic.

1. On page load, `shop.js`'s boot IIFE calls `loadProducts()`, which does
   `fetch(`${BACKEND_URL}/api/products`)`. The result is cached to
   `localStorage['krispies_products']` purely as an **offline fallback** — if the fetch fails,
   the last-known cached list is used instead so the page doesn't go blank.
2. `renderAll()` derives the list of categories to render **dynamically** from whatever
   `category` values come back from the API (`[...new Set(getProducts().map(p => p.category))]`)
   and fills in any `<div id="grid-<category>">` present on the page — so a brand-new category
   added in admin automatically gets a place to render without any code changes.
3. Editing/adding a product in `/admin/products.html` writes directly to the backend
   (`POST`/`PUT /api/products`) — changes are live on the public site immediately, no separate
   sync step.
4. `shop.js` dispatches a `shop:ready` event once products have loaded, which `product.html`
   listens for to look up its one product by slug.

### Product data shape (as returned by `GET /api/products`)

```js
{
  id:            string,
  slug:          string,        // unique, auto-generated from name, used in product.html URLs
  name:          string,
  category:      string,        // "birthday-cakes" | "wedding-cakes" | "engagement-cakes"
                                // | "baby-shower-cakes" | "half-year-birthday-cakes"
                                // | "gender-reveal-cakes" | "customized-cakes"
                                // | "cheesecakes" | "donuts" | "biscuits"
  tag:           string|null,   // "bestseller" | "new" | "seasonal" | "custom" | null
  description:   string,
  mrp:           number,        // full price in ₹ (e.g. 999) -- ignored once variantGroups is non-empty
  discount:      number,        // percentage e.g. 10 means 10% off -- ignored once variantGroups is non-empty
  price:         number,        // no variants: Math.round(mrp * (1 - discount/100)); with variants: = priceFrom
  priceFrom:     number,        // = price when no variants; cheapest combo price when variants exist
  priceTo:       number,        // = price when no variants; priciest combo price when variants exist
  images:        string[],      // array of image paths/URLs
  variantGroups: [{ name: string, options: [{ label: string, price: number, image: string|null }] }],
  prepHours:     number,        // hours of advance notice needed; gates the delivery-date picker
  featured:      boolean,       // show on homepage
  active:        boolean,       // show on menu/category pages
  createdAt:     string,
  updatedAt:     string,
}
```

### Variants

A product can have any number of **option groups** (e.g. "Weight", "Flavour"), each with options
that carry their own **absolute final price** (e.g. Half Kg = ₹699, 1 Kg = ₹1199) -- entering a
number for an option sets what that option costs the customer, it does not add to the MRP/discount
price above. The customer picks one option per group; if a product has more than one group, the
final price is the sum of the selected options across all groups (in practice, most products use a
single group). `mrp`/`discount` are only used for products with **no** variant groups. This is
managed from the admin product form's "Variants" section, and rendered as `<select>` dropdowns on
`product.html` and in the checkout modal's Step 1 (with the price updating live as options change).

Each option can optionally carry its own **image** — an **Upload** button next to each option
(same `POST /api/upload` flow as the main product photos above) or a pasted path/URL, either way
with a live thumbnail preview next to the field. For
categories in `js/shop.js`'s `CATEGORIES_WITH_VARIANT_CARDS` (currently just `rakhi-hampers`),
options render as clickable image+price cards instead of `<select>` dropdowns — an option's own
image is used if set, falling back to a client-side icon auto-picked from the option's label
(`renderVariantCards()`/`_variantOptionIconKey()` in `js/shop.js`) if no image is set or the image
URL fails to load. Other categories still get the plain `<select>` regardless of whether options
have images set.

### Prep time (`prepHours`)

If a product needs advance notice to prepare, set **Prep Time** in the admin form. The checkout
modal's minimum selectable delivery date becomes `today + ceil(prepHours / 24)` days, taking
whichever is later between that and the existing 24-hour-advance rule for wedding/engagement
cakes.

### Categories

| Key | Label |
|-----|-------|
| `birthday-cakes` | Birthday Cakes |
| `wedding-cakes` | Wedding Cakes |
| `engagement-cakes` | Engagement Cakes |
| `baby-shower-cakes` | Baby Shower Cakes |
| `half-year-birthday-cakes` | Half Year Birthday Cakes |
| `gender-reveal-cakes` | Gender Reveal Cakes |
| `customized-cakes` | Customized Cakes |
| `cheesecakes` | Cheesecakes |
| `donuts` | Donuts |
| `biscuits` | Biscuits |

New categories can be added ad hoc from the admin product form ("+ Add new category…") — no code
change needed, since category rendering is data-driven.

### Tags

| Key | Label | Badge colour |
|-----|-------|-------------|
| `bestseller` | Bestseller | Gold |
| `new` | New | Blue |
| `seasonal` | Seasonal | Orange |
| `custom` | Made to Order | Purple |

### Product images — direct upload

Product photos are uploaded straight from the browser: the admin form's **Upload Image** button
sends the file to `POST /api/upload` (JWT-protected, `backend/routes/upload.js`), which sniffs
the actual file bytes (not the filename or claimed MIME type) to confirm it's really a jpg/png/
webp/gif, saves it under a random name in `UPLOAD_DIR`, and returns a public `/uploads/<file>`
URL that's added straight to the product's image list — **live immediately, no code push**.
`UPLOAD_DIR` points at the Render persistent disk in production (see `render.yaml` — same disk
the SQLite DB lives on, see §14), so uploads survive redeploys.

The admin image field also still accepts a plain path/URL pasted directly (with a live thumbnail
preview either way) — this is how the seed catalog's own images are wired, and remains useful for
already-committed repo assets:

```
assets/images/products/<category>/<slug>-1.jpg
assets/images/products/<category>/<slug>-2.jpg   (additional gallery images, optional)
```

A path typed this way only works once that file actually exists at that path in the repo (i.e. is
committed and pushed) — pasting a path that doesn't exist yet will just show a broken thumbnail
until it's added. This local-folder route is optional now, not the only way to add a photo.

### Individual product pages

Every product has its own page at `product.html?slug=<slug>` — image gallery with thumbnails,
variant selectors, quantity, prep-time-aware delivery date, and Add to Cart / Buy Now. Product
cards everywhere (menu grids, category pages) link through to this page via their image/title,
while keeping a one-click "Add to Cart" button on the card itself for quick purchases without
leaving the grid.

### "Can't Find What You're Looking For?" CTA

Shown at the bottom of category sections. Has a form that POSTs to `${BACKEND_URL}/api/messages`
(same as contact form). Logic lives in `shop.js`'s `initSharedPageUI()`.

---

## 6. Buy Now Checkout Flow

Clicking **🛒 Buy Now** on any priced product card opens a 3-step modal:

### Step 1 — Order Details
- Product image + name + price shown
- Quantity selector (1–99)
- Preferred delivery/pickup date picker (min: tomorrow)
- Special instructions textarea (flavour, message on cake, etc.)

### Step 2 — Customer Details
- Full name (required)
- Phone number (required)
- Email (optional — for order confirmation)
- Delivery address (required)

### Step 3 — Delivery & Payment

**Home Delivery tab:**
- "📍 Detect My Location" button — uses browser Geolocation API
- Calculates distance (Haversine formula) from all 5 stores
- Auto-selects nearest store, shows all 5 sorted by distance
- Shows delivery fee based on distance tier

**Store Pickup tab:**
- Select any of 5 stores
- Pickup is always free

**Delivery fee tiers:**

| Distance | Fee |
|----------|-----|
| ≤ 3 km   | ₹30  |
| ≤ 6 km   | ₹60  |
| ≤ 10 km  | ₹100 |
| ≤ 15 km  | ₹150 |
| ≤ 20 km  | ₹200 |
| > 20 km  | ₹250 |

**Store coordinates (Hyderabad):**

| Store | Latitude | Longitude |
|-------|----------|-----------|
| Lalbazar | 17.3730 | 78.4760 |
| Suchitra | 17.5040 | 78.4450 |
| Boduppal | 17.4120 | 78.5820 |
| Ramantapur | 17.3980 | 78.5470 |
| Tukkuguda | 17.2850 | 78.5680 |

**Payment:** Online only (Razorpay) — **💳 Pay Online (Razorpay)** is the only checkout option; requires
Razorpay keys (see [Section 12](#12-razorpay-integration)). Cash on Delivery / Pay at Store has been
removed from the public checkout: it was a completed, unpaid order with no payment verification
behind it, so anyone scripting a direct request to the API (no UI needed) could "place an order"
for free. `POST /api/checkout` (the old COD endpoint) now always returns `410 Gone`. If Razorpay
isn't configured or `/initiate` fails, checkout shows an error and asks the customer to retry or
call the store — it no longer silently saves an unpaid "order" to `localStorage` as if it succeeded.
Admin can still manually log phone/walk-in/cash orders via `/admin/orders.html` → *Log New Order*
(hits the JWT-protected `POST /api/orders`, not the public checkout flow).

### Order submission flow

**Razorpay path:**
```
Click Pay Online
  → POST /api/checkout/initiate  (backend creates Razorpay order, saves pending DB row)
  → Razorpay checkout dialog opens
  → Customer pays
  → POST /api/checkout/verify   (backend verifies HMAC-SHA256 signature)
  → Order marked 'confirmed' in DB
  → Email sent to admin
  → Success screen
```

---

## 7. Admin Panel

**URL:** `www.krispies.in/admin/`  
**Password:** set via the `ADMIN_PASSWORD` env var on Render (see [Section 10](#10-environment-variables)) — bcrypt-hashed server-side, verified through `POST /api/auth/login`. There is no password in the frontend code. To change it, use `POST /api/auth/change-password` from a logged-in admin session, not by editing a file.  
**Auth:** JWT stored in `sessionStorage` — login expires when browser tab is closed

### Pages

| Page | URL | What it does |
|------|-----|-------------|
| Login | `/admin/` | Password entry |
| Dashboard | `/admin/dashboard.html` | Summary counts, recent activity |
| Products | `/admin/products.html` | Add/Edit/Delete products with full form |
| Enquiries | `/admin/enquiries.html` | View contact form submissions, mark read/responded |
| Orders | `/admin/orders.html` | View orders, update status |

### Admin data storage

The admin panel is **fully backend-API-driven** — product add/edit/delete, toggling
active/featured, all call the real `/api/products*` endpoints (JWT-protected) and write straight
to the SQLite database. There is no separate localStorage product store to keep in sync anymore;
`krispies_products` in localStorage is only ever a **read cache** written by the public site for
offline fallback, never a source of truth.

### localStorage keys (fallback / cache only — never authoritative)

| Key | Contains |
|-----|---------|
| `krispies_products` | Cached copy of the last successful `/api/products` response |
| `krispies_enquiries` | Contact form submissions (fallback when backend unreachable) |
| `krispies_orders` | Orders (fallback when backend unreachable) |
| `krispies_admin_token` | Admin JWT (sessionStorage, not localStorage) |

### Changing the admin password

The `ADMIN_PASSWORD` environment variable on Render is **only** consulted the very first time the
`users` table is empty (see `backend/db/database.js`) — it seeds the initial bcrypt hash and is
never read again afterward. If it's unset at that first boot, a random password is generated and
printed once to the Render service logs instead of falling back to any fixed value.

To change the password on a live admin account, log in and call `POST /api/auth/change-password`
(current + new password) — this is the only supported way; editing the env var after the admin
user already exists has no effect. Do this now if the account may have ever run with the old
`krispies2024` default (previously documented here in plaintext, which defeats the point of a
password) or with any password you're unsure of.

### Product form fields

| Field | Required | Notes |
|-------|----------|-------|
| Product Name | ✅ | |
| URL Slug | — | Auto-filled from name, editable. Used in `product.html?slug=...` |
| Category | ✅ | Dropdown of known categories + "Add new category…" free text |
| Tag | — | Bestseller / New / Seasonal / Made to Order / None |
| Prep Time (hours) | — | Advance notice needed; gates the delivery-date picker |
| Display Order | — | Lower shows first within its category; 0 (default) falls back to newest-first. Admin products table also has ▲▼ buttons per row to bump this without opening the edit form — filter to one category first so "up/down" means what it looks like |
| Description | ✅ | Shown under product name on menu and product page |
| MRP (₹) | ✅ | Full price before discount |
| Discount % | — | 0–100. Live preview shows final price |
| Product Images | — | Upload button, or paste a path/URL — live thumbnail preview either way, see §5 |
| Variants | — | Repeatable option groups (e.g. Weight, Flavour), each option carrying its own final price (not added to MRP) |
| Featured on Homepage | — | Checkbox — shows in homepage featured section |
| Active | — | Uncheck to hide from menu without deleting |

---

## 8. Backend API

**Base URL:** Set in `js/main.js` as `BACKEND_URL`  
**Framework:** Express.js  
**Auth:** JWT (`Authorization: Bearer <token>` header)

### Endpoints

#### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | None | Returns JWT token |

#### Products (requires JWT)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List all products (with filters) |
| GET | `/api/products/:id` | Single product |
| POST | `/api/products` | Create product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |

#### Orders (requires JWT)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/orders` | List orders (filterable by status/platform/outlet) |
| GET | `/api/orders/:id` | Single order |
| POST | `/api/orders` | Create order (admin use) |
| PUT | `/api/orders/:id` | Update order |
| PATCH | `/api/orders/:id/status` | Update status only |
| DELETE | `/api/orders/:id` | Delete order |

#### Messages (POST is public)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/messages` | JWT | List all messages |
| GET | `/api/messages/:id` | JWT | Single message |
| POST | `/api/messages` | None | Submit contact form (public) |
| PATCH | `/api/messages/:id/status` | JWT | Mark read/responded |
| DELETE | `/api/messages/:id` | JWT | Delete message |

#### Customers — "My Account" (mixed auth)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/customers/signup` | None | Phone + password signup, auto-login |
| POST | `/api/customers/login` | None | Phone + password login |
| POST | `/api/customers/otp/request` | None | Email OTP login/signup — emails a 6-digit code, 10 min expiry |
| POST | `/api/customers/otp/verify` | None | Checks the code; auto-creates the account (needs `name` in the body) the first time an email is used, otherwise just logs in |
| GET | `/api/customers/me` | Customer JWT | Current profile |
| GET | `/api/customers/orders` | Customer JWT | This customer's order history |
| GET/POST/PUT/DELETE | `/api/customers/addresses` | Customer JWT | Saved address book |
| GET | `/api/customers` | Admin JWT | List all customer accounts (admin) |
| DELETE | `/api/customers/:id` | Admin JWT | Delete a customer account (admin) |

Phone+password and email+OTP are two independent ways into the same `customers` table — a customer can have either, both, or (via OTP) neither a phone nor a password. Admin login and customer login use separate JWT types (`middleware/auth.js` rejects a customer token on admin routes and vice versa) and separate expiry env vars — `JWT_EXPIRES_IN` (admin, 8h) vs `CUSTOMER_JWT_EXPIRES_IN` (customer, 7d) — since the customer token lives in `localStorage` for a "stay logged in" shopping UX rather than `sessionStorage`.

#### Checkout (all public — no auth)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/checkout` | Disabled — always `410 Gone`. COD/Pay-at-store was removed; kept as a route only so old clients get a clear error instead of a 404. |
| POST | `/api/checkout/initiate` | Create Razorpay order, returns order details |
| POST | `/api/checkout/verify` | Verify Razorpay HMAC-SHA256 signature |

#### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Returns `{ status: 'ok', timestamp }` |

### Rate limiting

Global: 200 requests per 15 minutes per IP.

---

## 9. Database Schema

**Engine:** SQLite (file: `backend/db/krispies.db`)  
**Mode:** WAL (Write-Ahead Logging) for better concurrent reads

### `users` table
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
username    TEXT NOT NULL UNIQUE
password    TEXT NOT NULL          -- bcrypt hash
created_at  TEXT DEFAULT (datetime('now'))
```

### `products` table
```sql
id             TEXT PRIMARY KEY       -- random short ID
name           TEXT NOT NULL
category       TEXT NOT NULL
tag            TEXT                   -- bestseller | new | seasonal | custom | NULL
description    TEXT NOT NULL
mrp            REAL DEFAULT 0
discount       REAL DEFAULT 0         -- percentage, 0-100
images         TEXT DEFAULT '[]'      -- JSON array of image paths/URLs
variant_groups TEXT DEFAULT '[]'      -- JSON: [{name, options:[{label, price, image}]}] -- price is absolute, not a delta; image is optional
prep_hours     INTEGER DEFAULT 0      -- advance notice needed, gates delivery date picker
slug           TEXT UNIQUE            -- used in product.html?slug=...
featured       INTEGER DEFAULT 0      -- 0 or 1
trending       INTEGER DEFAULT 0      -- 0 or 1 -- shown on GET /api/products/trending
sort_order     INTEGER DEFAULT 0      -- display order within a category, lower shows first; ties
                                       -- break by created_at DESC (newest first, the old default)
active         INTEGER DEFAULT 1      -- 0 or 1
created_at     TEXT DEFAULT (datetime('now'))
updated_at     TEXT DEFAULT (datetime('now'))
```

Also note: `backend/db/database.js` runs a **strictly one-time** seed/migration on first boot
(guarded by a `settings.catalog_seeded_v1` flag) that replaces any pre-existing imageless
placeholder catalog with the real, image-backed catalog the public site already uses. It will
never run again after that flag is set, so it's safe from ever wiping products the team adds
later via admin.

### `orders` table
```sql
id              TEXT PRIMARY KEY
customer_name   TEXT NOT NULL
customer_phone  TEXT
items           TEXT NOT NULL      -- "Chocolate Overload × 2"
quantity        TEXT
amount          REAL               -- total in ₹
platform        TEXT               -- website | zomato | swiggy | walk-in | phone | bulk
outlet          TEXT               -- lalbazar | suchitra | boduppal | ramantapur | tukkuguda
order_date      TEXT               -- YYYY-MM-DD
delivery_date   TEXT               -- YYYY-MM-DD
status          TEXT DEFAULT 'pending'  -- pending | confirmed | ready | delivered | cancelled
notes           TEXT               -- delivery address, mode, payment method, etc.
created_at      TEXT DEFAULT (datetime('now'))
updated_at      TEXT DEFAULT (datetime('now'))
```

### `messages` table
```sql
id          TEXT PRIMARY KEY
name        TEXT NOT NULL
phone       TEXT
email       TEXT
event_type  TEXT                   -- birthday | wedding | anniversary | etc.
outlet      TEXT
quantity    TEXT
event_date  TEXT
products    TEXT
message     TEXT
status      TEXT DEFAULT 'unread'  -- unread | read | responded
created_at  TEXT DEFAULT (datetime('now'))
```

### `customers` table — "My Account" logins
```sql
id            TEXT PRIMARY KEY
name          TEXT NOT NULL
phone         TEXT UNIQUE            -- nullable: an email-OTP-only account has no phone
email         TEXT UNIQUE            -- nullable: a phone+password account may not set one
password_hash TEXT                   -- nullable: null for accounts that only ever used email OTP
created_at    TEXT DEFAULT (datetime('now'))
```
`phone` and `password_hash` were `NOT NULL` before email-OTP login existed. `backend/db/database.js`
runs a one-time table-rebuild migration (SQLite has no `ALTER COLUMN`) that drops those constraints
on any existing DB — it's guarded by inspecting the live schema via `PRAGMA table_info`, not a
settings flag, so it's naturally a no-op everywhere it's already run, including fresh installs.

### `addresses` table — saved delivery addresses, keyed to a customer
```sql
id          TEXT PRIMARY KEY
customer_id TEXT NOT NULL            -- FK → customers.id, ON DELETE CASCADE
label       TEXT DEFAULT 'Home'
name        TEXT NOT NULL
phone       TEXT NOT NULL            -- the address's own contact phone, independent of customers.phone
line        TEXT NOT NULL
city        TEXT DEFAULT 'Hyderabad'
pincode     TEXT
is_default  INTEGER DEFAULT 0
created_at  TEXT DEFAULT (datetime('now'))
```

### `email_otps` table — one-time login codes for email OTP
```sql
id         TEXT PRIMARY KEY
email      TEXT NOT NULL
otp_hash   TEXT NOT NULL             -- bcrypt hash; the plaintext code is never stored
expires_at TEXT NOT NULL             -- created_at + 10 minutes
attempts   INTEGER DEFAULT 0         -- locked out at 5 wrong guesses
consumed   INTEGER DEFAULT 0         -- 0/1 — a used or expired code can't be replayed
created_at TEXT DEFAULT (datetime('now'))
```
Requesting a new code for an email deletes any still-live code for that email first, so only the
most recently sent one ever works. Expired rows are opportunistically swept on each new request
rather than needing a scheduled cleanup job.

---

## 10. Environment Variables

**File:** `backend/.env` (never commit to Git — it's in `.gitignore`)

```env
# Server
PORT=3000

# Security
JWT_SECRET=your_long_random_secret_string_here
JWT_EXPIRES_IN=8h              # admin login session length
CUSTOMER_JWT_EXPIRES_IN=7d     # customer "My Account" session length — kept
                                # separate from admin above since this token
                                # lives in localStorage for a "stay logged
                                # in" shopping UX, not sessionStorage

# Admin login password (for backend API) — only used to seed the admin
# account the very first time the users table is empty; ignored afterward.
# Pick a strong, unique value. If left unset, a random one is generated
# and printed once to the server logs on first boot.
ADMIN_PASSWORD=choose_a_strong_unique_password

# Email — notifications sent TO this address
ADMIN_EMAIL=your@email.com

# Gmail account that SENDS the notifications
EMAIL_USER=your.gmail@gmail.com
EMAIL_PASS=your_gmail_app_password   # Gmail App Password, NOT your real password

# CORS — your frontend domain
FRONTEND_URL=https://www.krispies.in

# Razorpay (add when you get keys)
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXXXXXX
```

**Gmail App Password setup:**
1. Gmail → Settings → Security → Enable 2-Step Verification
2. Security → App Passwords → Select app: Mail → Generate
3. Copy the 16-character password into `EMAIL_PASS`

---

## 11. Deployment

### Frontend — Cloudflare Pages (the actual live domain)

- **`www.krispies.in` / `krispies.in` are bound to Cloudflare Pages** (`krispies-website.pages.dev`), confirmed via DNS (`CNAME` → `krispies-website.pages.dev`) and the `server: cloudflare` response header on every request.
- Connected to GitHub repo `Surabhianand13/krispies-website`, auto-deploys on every push to `main`
- No build step — serves static files directly
- Rewrites/redirects for this project live in **`_redirects`** (Cloudflare Pages syntax: `source  destination  status`, `200` = rewrite/URL stays visible, `301`/`302` = redirect). This is the file that actually takes effect in production.
- **A `vercel.json` also exists in the repo and a Vercel project is connected and builds successfully on every push** (visible as a passing check on PRs) — but it is not what the custom domain resolves to. Any Vercel-specific config (rewrites, redirects, headers) has **zero effect on the live site**. Keep both in sync if you rely on Vercel for anything (e.g. preview deployments), but treat `_redirects`/`_headers` as the source of truth for production routing.

**To deploy changes:**
```bash
cd /Users/surabhia/krispies-website
git add <files>
git commit -m "your message"
git push origin main
# Cloudflare Pages auto-deploys in ~30-60 seconds
```

### Backend — Render

- Deployed as a Node.js web service
- Start command: `node server.js`
- Set all env vars in Render → Settings → Environment
- Free tier spins down after inactivity — first request after sleep takes ~30s

**After deploying backend, update `BACKEND_URL` in `js/main.js`:**
```js
const BACKEND_URL = 'https://your-render-url.onrender.com';
```

**To install backend dependencies locally:**
```bash
cd /Users/surabhia/krispies-website/backend
npm install
npm run dev    # starts with nodemon (auto-restart on changes)
```

---

## 12. Razorpay Integration

The integration is fully built. You just need to add your keys.

### Steps to activate

**Step 1:** Create a Razorpay account at [razorpay.com](https://razorpay.com)

**Step 2:** Go to Razorpay Dashboard → Settings → API Keys → Generate Test Keys first

**Step 3:** Add to your Render environment variables:
```
RAZORPAY_KEY_ID     = rzp_test_XXXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET = XXXXXXXXXXXXXXXXXXXXXXXX
```

**Step 4:** Install the package on backend (if not done already):
```bash
cd backend && npm install
```

**Step 5:** When ready for live payments, replace test keys with live keys:
```
RAZORPAY_KEY_ID     = rzp_live_XXXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET = XXXXXXXXXXXXXXXXXXXXXXXX
```

### How the payment flow works (technical)

```
1. Customer clicks "Pay Online"
2. Frontend → POST /api/checkout/initiate
   - Backend creates Razorpay order via API
   - Saves pending DB row with internal ID
   - Returns { razorpay_order_id, internal_order_id, amount (paise), key_id }
3. Frontend loads Razorpay checkout SDK dynamically
4. Razorpay dialog opens (UPI, Cards, Netbanking, Wallets)
5. Customer completes payment
6. Razorpay calls handler() with { razorpay_payment_id, razorpay_order_id, razorpay_signature }
7. Frontend → POST /api/checkout/verify
   - Backend verifies: HMAC-SHA256(order_id + "|" + payment_id, key_secret) === signature
   - If valid → order status set to 'confirmed'
   - Email notification sent to admin
8. Success screen shown to customer
```

---

## 13. How to Make Common Changes

### Change product prices / add discounts
1. Go to `www.krispies.in/admin/products.html`
2. Click **Edit** on any product
3. Update MRP and Discount % → live preview shows final price
4. Click **Save Changes** — changes appear on menu immediately

### Add a new product
1. Admin → Products → **+ Add Product**
2. Fill in all fields, add image URLs, check **Active**
3. Check **Featured on Homepage** to show it on the home page too

### Add product images
- In the product edit form, click **Upload Image** and pick a file — it's live immediately
- Or paste a direct image URL / already-committed repo path instead, if you prefer
- Multiple images supported — customers swipe through them

### Change carousel slides (homepage)
Edit `index.html` — find the `.hero__slide` blocks. Each slide looks like:
```html
<div class="hero__slide">
  <div class="hero__slide-bg"></div>
  <div class="hero__slide-overlay"></div>
  <div class="hero__content">
    <span class="section-label">Your Label</span>
    <h1>Your Heading</h1>
    <p>Your subtext</p>
    <div class="hero__cta">
      <a href="menu.html" class="btn btn-gold">View Menu</a>
    </div>
  </div>
  <div class="hero__art">🎂</div>   <!-- Replace with <img> -->
</div>
```

### Change the admin password
Log into `/admin/` and call `POST /api/auth/change-password` with your current and new password
(see [Section 7](#7-admin-panel)). There is no password stored in the frontend code to edit.

### Connect backend to frontend
Edit `js/main.js` line ~40:
```js
const BACKEND_URL = 'https://your-render-url.onrender.com';
```

### Change delivery fees or store coordinates
Edit the STORES array and `deliveryFee()` function in `menu.html` (bottom `<script>` block):
```js
const STORES = [
  { name: 'Lalbazar',   lat: 17.3730, lng: 78.4760 },
  // ... add/edit stores here
];

function deliveryFee(km) {
  if (km <= 3)  return 30;
  // ... edit tiers here
}
```

### Add a new article
1. Copy an existing article file in `articles/`
2. Update the content
3. Add a link card to `articles/index.html`

---

## 14. Known Issues & Gotchas

### `const` redeclaration crashes inline scripts
If you add a `const BACKEND_URL` declaration inside a `<script>` block on any page that also loads `main.js`, it will throw `SyntaxError: Identifier 'BACKEND_URL' has already been declared` and silently kill the entire script. Always use the one defined in `main.js`.

### Backend free tier cold starts
Render free tier suspends the backend after 15 min of inactivity. The first request after sleep takes ~20–30 seconds. Contact form submissions during this time fall back to localStorage gracefully.

### Backend persistent disk
`render.yaml` attaches a 1 GB persistent disk (`krispies-data`, mounted at `/var/data`), and both
`DB_PATH` and `UPLOAD_DIR` point into it — so `backend/db/krispies.db` and everything under
`backend/uploads/` (product photos uploaded via the admin panel, see §5) survive a redeploy.
**Confirm this is still true before relying on it** — if the disk is ever removed from the Render
service or those env vars get unset, both the DB and uploaded photos would fall back to the
container's local (non-persistent) filesystem and could be wiped on the next redeploy.

### Gmail App Password required
Regular Gmail password won't work for `nodemailer`. You must generate an App Password (16-character code) from Gmail Security settings with 2FA enabled.

### Razorpay "Pay Online" requires backend to be connected
If `BACKEND_URL` is still `localhost:3000` and you're on the live site, Razorpay won't work, and
checkout has no fallback anymore since COD was removed — customers will see "Online payment is
temporarily unavailable" and be asked to call the store instead.

---

## 15. Pending / Future Work

| Feature | Status | Notes |
|---------|--------|-------|
| **Real product images** | 🔲 Pending | Structure ready — just add image URLs via admin |
| **Razorpay keys** | 🔲 Pending | Integration built — user to provide keys |
| **Backend URL update** | 🔲 Pending | Update `BACKEND_URL` in `js/main.js` to Render URL |
| **Google Analytics GA4** | 🔲 Pending | Add `G-XXXXXXXXXX` measurement ID to all pages |
| **Google Search Console** | 🔲 Pending | Auto-verifies once GA4 is added |
| **Email notifications** | 🔲 Pending | Configure `EMAIL_USER` / `EMAIL_PASS` in backend `.env` |
| **Admin panel cross-device sync** | 🔲 Future | Hook admin panel to backend API instead of localStorage |
| **Order tracking for customer** | 🔲 Future | SMS / WhatsApp notification via Twilio |
| **Festive product banners** | 🔲 Future | Seasonal hero slides with real images |

---

## Brand Reference

| | |
|-|--|
| **Brand name** | Krispie's |
| **Founded** | 1996 |
| **Heritage** | Iyengar baking tradition |
| **Tagline** | Your Celebrations Partner |
| **City** | Hyderabad |
| **Outlets** | Lalbazar, Suchitra, Boduppal, Ramantapur, Tukkuguda |
| **Instagram** | [@krispies.in](https://www.instagram.com/krispies.in) |
| **Facebook** | [krispies.in](https://www.facebook.com/krispies.in) |
| **Zomato** | [Link](https://www.zomato.com/hyderabad/search?q=krispies) |
| **Swiggy** | [Link](https://www.swiggy.com/search?query=krispies+hyderabad) |
| **Primary colour** | Gold `#C9A870` |
| **Background** | Near-black `#0A0A0A` |
| **Display font** | Playfair Display (Google Fonts) |
| **Body font** | Inter (Google Fonts) |
