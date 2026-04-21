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
├── menu.html               ← Full menu (dynamic, reads from localStorage)
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
│   └── main.js             ← Shared frontend JS (nav, hero carousel, contact form)
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

## 5. Menu Page & Dynamic Products

### How it works

1. On page load, `ensureDefaults()` checks if `localStorage['krispies_products']` exists. If not, it seeds ~36 default products.
2. `renderAll()` reads products from localStorage, filters by category and `active: true`, and builds HTML cards.
3. The admin panel writes products to the same localStorage key — so admin changes immediately appear on the menu.

### Product data shape

```js
{
  id:          string,        // e.g. "m3k1a2b"
  name:        string,        // "Chocolate Overload"
  category:    string,        // "birthday-cakes" | "customized-cakes" | "wedding-cakes"
                              // | "engagement-cakes" | "cheesecakes" | "donuts"
  tag:         string|null,   // "bestseller" | "new" | "seasonal" | "custom" | null
  description: string,
  mrp:         number,        // full price in ₹ (e.g. 999)
  discount:    number,        // percentage e.g. 10 means 10% off
  images:      string[],      // array of direct image URLs
  featured:    boolean,       // show on homepage
  active:      boolean,       // show on menu page
  createdAt:   ISO string,
  updatedAt:   ISO string,
}
```

**Final price** = `Math.round(mrp * (1 - discount / 100))`

### Categories

| Key | Label | Emoji |
|-----|-------|-------|
| `birthday-cakes` | Birthday Cakes | 🎂 |
| `customized-cakes` | Customized Cakes | 🎨 |
| `wedding-cakes` | Wedding Cakes | 💍 |
| `engagement-cakes` | Engagement Cakes | 💐 |
| `cheesecakes` | Cheesecakes | 🍰 |
| `donuts` | Donuts | 🍩 |

### Tags

| Key | Label | Badge colour |
|-----|-------|-------------|
| `bestseller` | Bestseller | Gold |
| `new` | New | Blue |
| `seasonal` | Seasonal | Orange |
| `custom` | Made to Order | Purple |

### Product image galleries

Each product supports **multiple images**. Images are entered as direct URLs in the admin panel (Cloudinary, Google Drive direct links, any public URL). Customers can swipe through them on the menu page.

**To add product images:**
1. Go to `www.krispies.in/admin/products.html`
2. Click **Edit** on a product
3. Paste image URLs in the Image URL fields
4. Click **Save Changes**

### "Can't Find What You're Looking For?" CTA

Shown at the bottom of Birthday, Customized, Wedding, and Engagement cake sections. Has a form that POSTs to `${BACKEND_URL}/api/messages` (same as contact form).

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

**Payment options:**
1. **📦 Cash on Delivery / Pay at Store** — works immediately, no external setup
2. **💳 Pay Online (Razorpay)** — requires Razorpay keys (see [Section 12](#12-razorpay-integration))

### Order submission flow

**COD path:**
```
Click COD → POST /api/checkout → Order saved in DB → Email sent to admin → Success screen
```
If backend is unreachable → order saved to `localStorage['krispies_orders']` as fallback.

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
**Password:** `krispies2024` (change in `admin/admin.js` line 10)  
**Auth:** `sessionStorage` — login expires when browser tab is closed

### Pages

| Page | URL | What it does |
|------|-----|-------------|
| Login | `/admin/` | Password entry |
| Dashboard | `/admin/dashboard.html` | Summary counts, recent activity |
| Products | `/admin/products.html` | Add/Edit/Delete products with full form |
| Enquiries | `/admin/enquiries.html` | View contact form submissions, mark read/responded |
| Orders | `/admin/orders.html` | View orders, update status |

### Admin data storage

The admin panel uses **browser localStorage** for product data. This means:
- Products edited in admin **immediately appear** on the live menu (same browser)
- Data is **per-browser** — if you use a different browser/device, the data won't sync
- To share data across devices → connect the backend API (future enhancement)

### localStorage keys

| Key | Contains |
|-----|---------|
| `krispies_products` | All products array |
| `krispies_enquiries` | Contact form submissions (fallback) |
| `krispies_orders` | Orders (fallback when backend unreachable) |
| `krispies_admin_auth` | Admin session token (sessionStorage) |

### Changing the admin password

Open `admin/admin.js`, line 10:
```js
const ADMIN_PASSWORD = 'krispies2024';   // ← change this
```

### Product form fields

| Field | Required | Notes |
|-------|----------|-------|
| Product Name | ✅ | |
| Category | ✅ | Dropdown — 6 categories |
| Tag | — | Bestseller / New / Seasonal / Made to Order / None |
| Description | ✅ | Shown under product name on menu |
| MRP (₹) | ✅ | Full price before discount |
| Discount % | — | 0–100. Live preview shows final price |
| Product Images | — | Paste direct image URLs. Multiple supported. |
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

#### Checkout (all public — no auth)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/checkout` | Place COD / Pay-at-store order |
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
id          TEXT PRIMARY KEY       -- random short ID
name        TEXT NOT NULL
category    TEXT NOT NULL
tag         TEXT                   -- bestseller | new | seasonal | custom | NULL
description TEXT NOT NULL
featured    INTEGER DEFAULT 0      -- 0 or 1
active      INTEGER DEFAULT 1      -- 0 or 1
created_at  TEXT DEFAULT (datetime('now'))
updated_at  TEXT DEFAULT (datetime('now'))
```

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

---

## 10. Environment Variables

**File:** `backend/.env` (never commit to Git — it's in `.gitignore`)

```env
# Server
PORT=3000

# Security
JWT_SECRET=your_long_random_secret_string_here
JWT_EXPIRES_IN=8h

# Admin login password (for backend API)
ADMIN_PASSWORD=krispies2024

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

### Frontend — Vercel

- Connected to GitHub repo `Surabhianand13/krispies-website`
- Auto-deploys on every push to `main`
- Domain: `www.krispies.in`
- No build step — Vercel serves static files directly

**To deploy changes:**
```bash
cd /Users/surabhia/krispies-website
git add <files>
git commit -m "your message"
git push origin main
# Vercel auto-deploys in ~30 seconds
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
- In the product edit form, paste direct image URLs
- Use [Cloudinary](https://cloudinary.com) (free) to host images and get URLs
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
Edit `admin/admin.js` line 10:
```js
const ADMIN_PASSWORD = 'your-new-password';
```

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

### Admin data is browser-local
Products are stored in `localStorage` of whichever browser you use for admin. If you log in from a different device, products won't be there. The backend has its own separate products table (via API) — but the frontend menu reads from localStorage, not the API. These two are currently independent.

### Backend free tier cold starts
Render free tier suspends the backend after 15 min of inactivity. The first request after sleep takes ~20–30 seconds. Contact form submissions during this time fall back to localStorage gracefully.

### Gmail App Password required
Regular Gmail password won't work for `nodemailer`. You must generate an App Password (16-character code) from Gmail Security settings with 2FA enabled.

### Razorpay "Pay Online" requires backend to be connected
If `BACKEND_URL` is still `localhost:3000` and you're on the live site, Razorpay won't work. The fallback message "Please use Cash on Delivery" will show. COD always works even without backend.

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
