# Krispie's Website — Setup Guide

## Project Structure

```
krispies-website/
├── index.html          Homepage (banner carousel, menu preview, story, testimonials, locations)
├── menu.html           Full menu
├── story.html          Founding story
├── contact.html        Bulk / corporate enquiry form
├── articles/           SEO blog articles
├── css/styles.css      All website styles
├── js/main.js          All website JavaScript (nav, carousel, contact form)
├── assets/             Logo, images, fonts
├── admin/              Password-protected admin panel (pure HTML/JS + localStorage)
└── backend/            Node.js + Express API server (SQLite, JWT, email)
```

---

## 1. Running the frontend (static site)

No build step needed. Open any HTML file in a browser, or serve with:

```bash
npx serve -l 3737 /path/to/krispies-website
```

Then visit http://localhost:3737

---

## 2. Setting up the backend

### Step 1 — Install dependencies

```bash
cd backend
npm install
```

### Step 2 — Create your .env file

```bash
cp .env.example .env
```

Then open `.env` and fill in your values:

| Variable         | What to put                                                   |
|-----------------|---------------------------------------------------------------|
| `JWT_SECRET`     | Any long random string (keep secret!)                         |
| `ADMIN_PASSWORD` | The password for the admin panel login                        |
| `ADMIN_EMAIL`    | Your business email — notifications arrive here               |
| `EMAIL_USER`     | Your Gmail address that SENDS notifications                   |
| `EMAIL_PASS`     | Gmail App Password (NOT your Gmail login password — see below)|
| `FRONTEND_URL`   | Your website URL (for CORS). Use http://localhost:3737 locally|

#### How to get a Gmail App Password:
1. Go to myaccount.google.com → Security
2. Enable 2-Step Verification (required)
3. Search for "App Passwords" → Create one → Name it "Krispie's Website"
4. Copy the 16-character password into `EMAIL_PASS`

### Step 3 — Start the server

Development (auto-restarts on changes):
```bash
npm run dev
```

Production:
```bash
npm start
```

The server runs on http://localhost:3000 by default.

### Step 4 — Connect the frontend

Open `js/main.js` and set:
```javascript
const BACKEND_URL = 'http://localhost:3000';
```

Change this to your actual server URL when you deploy (e.g. `https://api.krispies.in`).

---

## 3. Admin panel

Visit `/admin/` in your browser. Default password: `krispies2024`

**When the backend is running**, the admin panel uses real JWT authentication via the API.  
**When the backend is offline**, it falls back to localStorage (so you can still demo locally).

---

## 4. Updating banner images (hero carousel)

The 5 hero slides currently use CSS gradient backgrounds + emoji art.

### To add a real photo to a slide:

**Step 1** — Add your image to `assets/` (e.g. `assets/banner-1.jpg`)  
Recommended size: **1400 × 900px** minimum. Use WebP for better performance.

**Step 2** — Open `index.html`, find the slide you want to update (e.g. Slide 1), and change:
```html
<!-- BEFORE (emoji art placeholder) -->
<div class="hero__slide-bg"></div>
...
<div class="hero__art" aria-hidden="true">🎂</div>

<!-- AFTER (real photo) -->
<div class="hero__slide-bg" style="background-image: url('assets/banner-1.jpg');"></div>
...
<img src="assets/banner-circle-1.jpg" alt="Custom cakes" 
     style="width:100%;height:100%;object-fit:cover;border-radius:50%;">
```

**Step 3** — Optionally dim/brighten the overlay in `css/styles.css`:
```css
.hero__slide-overlay {
  background: rgba(255, 248, 240, 0.35); /* reduce to 0.15 for darker overlay */
}
```

---

## 5. Updating YouTube videos

Open `index.html`, search for `YOUR_VIDEO_ID`, and replace each with your real YouTube video ID.

The video ID is the part after `?v=` in a YouTube URL:  
`https://www.youtube.com/watch?v=`**`dQw4w9WgXcQ`** → ID is `dQw4w9WgXcQ`

Replace this comment block in each video placeholder:
```html
<!-- PASTE YOUTUBE EMBED:
<iframe width="100%" height="100%"
  src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowfullscreen>
</iframe>
-->
```
Remove the `<!--` and `-->` wrapper, and replace `YOUR_VIDEO_ID` with your actual ID.

---

## 6. Backend API reference

All protected routes require header: `Authorization: Bearer <token>`

| Method | Endpoint                    | Auth?    | Description                  |
|--------|-----------------------------|----------|------------------------------|
| POST   | `/api/auth/login`           | No       | Get JWT token                |
| GET    | `/api/auth/me`              | Yes      | Verify token                 |
| POST   | `/api/auth/change-password` | Yes      | Change admin password        |
| GET    | `/api/products`             | No       | List active products         |
| GET    | `/api/products?all=1`       | Yes      | List all products            |
| POST   | `/api/products`             | Yes      | Add product                  |
| PUT    | `/api/products/:id`         | Yes      | Update product               |
| DELETE | `/api/products/:id`         | Yes      | Delete product               |
| POST   | `/api/messages`             | No       | Submit contact form (public) |
| GET    | `/api/messages`             | Yes      | List all enquiries           |
| PATCH  | `/api/messages/:id`         | Yes      | Update status                |
| DELETE | `/api/messages/:id`         | Yes      | Delete enquiry               |
| GET    | `/api/orders`               | Yes      | List orders                  |
| POST   | `/api/orders`               | Yes      | Log new order                |
| PUT    | `/api/orders/:id`           | Yes      | Update order                 |
| PATCH  | `/api/orders/:id/status`    | Yes      | Quick status update          |
| DELETE | `/api/orders/:id`           | Yes      | Delete order                 |
| GET    | `/api/health`               | No       | Health check                 |
