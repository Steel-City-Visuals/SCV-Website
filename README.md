# Steel City Visuals — Website

Custom-coded marketing website for Steel City Visuals (SCV), a Pittsburgh-based visual media production company. Rebuilt from Wix to a fully static site for better performance, control, and professionalism.

**Live domain:** steelcityvisuals.com  
**Hosting:** GitHub Pages  
**Tech stack:** Plain HTML / CSS / JS — no frameworks, no build system, no npm

---

## Pages

| File | Description |
|---|---|
| `index.html` | Main site — all primary sections |
| `portfolio.html` | Portfolio gallery with category filtering and lightbox |
| `blog.html` | Blog listing page with category filter and load-more pagination |
| `blog-post.html` | Single post page — loaded dynamically by slug from `blog/posts.json` |
| `admin.html` | Password-protected blog CMS — create, edit, publish, and delete posts |
| `privacy.html` | Privacy Policy |
| `accessibility.html` | Accessibility Statement |

---

## Site Sections (index.html)

### Hero
Full-screen dark hero with SCV headline, subtext, and dual CTAs (Book Now → booking portal, View Our Work → portfolio). Parallax scroll effect on hero background.

### Trust Strip
Infinite auto-scrolling logo marquee of partner/client brands: Compass, eXp Realty, Coldwell Banker, Howard Hanna, Realty One Group, Charter Homes, HMA, Tenaris, Coca-Cola, Sotheby's.

### Services
Real Estate Marketing featured full-width card (Most Popular), then four service cards in a 2×2 grid:
- **Branding**
- **Premium Wedding Imagery**
- **Aerial Drone Photography**
- **Corporate**

> Social Media Marketing card is written but commented out — ready to enable when the service launches.

### Blog Preview
Three most recent published posts rendered from `blog/posts.json`. Links through to `blog.html` and individual `blog-post.html?slug=` pages.

### Pricing
- **Real Estate** — dynamic pricing via booking portal (instant quote based on address/sq footage)
- **Branding** — from $250 (headshots), reels from $450, bio films from $3,995
- **Premium Wedding** — from $2,500; combo packages from $6,600
- **Aerial Drone** — Get a Quote Today
- **Corporate** — Get a Quote Today
- **Social Media Marketing** — full-width featured block, Get a Quote Today

### Stats
Animated count-up numbers on scroll:
- 1,200+ Drone Flight Hours
- 3,000+ Shoots Completed
- 5-Star Rating
- Next-Day Turnaround

### About / Team
Pittsburgh golden-hour background image with company story. Six team member cards with headshots and LinkedIn links:
- Kyle Jennings — Owner, Executive Producer
- Nicholas Colicchie — Real Estate Director, HR Manager
- Conner Kelly — Creative Director, Visual Media Producer
- Jessica Mastrean — Post Production & Motion Graphic Manager
- Jade Fuccaro — Graphic Design Specialist
- Kristi Sipes — Visual Media Producer

### Testimonials
Two-row horizontal auto-scrolling marquee (row 1 left, row 2 right) with 8 client reviews. Pauses on hover. Fade mask on edges.

### Contact
AJAX contact form via Formspree (endpoint: `xqejzloe`). Submits without page navigation. Inline success state on send. Also displays: email, office address, booking portal link.

### Footer
Logo, social links (LinkedIn, Facebook, Instagram), nav links, legal links, copyright.

---

## Portfolio Page

- Category filter buttons: All, Aerial, Real Estate, Wedding, Corporate
- Masonry-style image grid
- Lightbox with keyboard navigation (arrow keys, Escape), prev/next buttons, focus trap for accessibility
- Currently populated: 17 aerial shots, 2 real estate shots (wedding and corporate tabs are empty state)

---

## Blog

### How it works
All blog data lives in `blog/posts.json` — an array of post objects. The blog listing and single post pages fetch this file at runtime and render from it. No server required.

### Post object shape
```json
{
  "slug": "unique-url-slug",
  "title": "Post Title",
  "author": "Author Name",
  "date": "YYYY-MM-DD",
  "category": "Real Estate",
  "excerpt": "Short summary shown on listing cards.",
  "image": "assets/images/blog/cover.jpg",
  "body": "<p>Full HTML content...</p>",
  "status": "published"
}
```

Status values: `"published"` (live) or `"draft"` (admin-only preview).

### Categories
Real Estate, Aerial, Wedding, Corporate, Behind the Scenes, Tips

---

## Blog Admin CMS (admin.html)

Password-protected CMS for managing blog posts without touching code.

### Access
- Navigate to `admin.html` (URL is not linked publicly)
- Hidden entry point: click the footer copyright text **5 times within 3 seconds** on any page → redirects to admin
- Enter the admin password → enter your GitHub personal access token once (stored encrypted in localStorage)

### GitHub token requirements
The admin commits directly to the GitHub repo via the GitHub Contents API. Each editor needs a **fine-grained personal access token** scoped to:
- **Repository:** Steel-City-Visuals/SCV-Website only
- **Permission — Contents:** Read and Write

Tokens are named per editor in GitHub settings for individual revocation. To revoke an editor's access, delete their token in GitHub → Developer Settings → Fine-grained tokens.

### Security model
- Password hashed with PBKDF2 (100,000 iterations, SHA-256)
- GitHub token encrypted at rest with AES-GCM 256-bit (key derived from password)
- Encrypted token stored in `localStorage`; decryption key lives only in `sessionStorage` (cleared on tab close)
- Token is sent only to `api.github.com` over HTTPS — never to any third party

### Publish flow
All changes are staged locally and require an explicit **Publish** action to commit to GitHub. **Discard** rolls back all pending changes. Exception: image uploads commit immediately (binary files cannot be batched into a JSON commit).

---

## JavaScript

| File | Purpose |
|---|---|
| `js/nav.js` | Transparent → frosted-glass nav on scroll, hamburger mobile menu, back-to-top button |
| `js/animations.js` | IntersectionObserver scroll-reveal, stat count-up animation, hero parallax |
| `js/contact.js` | Formspree AJAX submission, loading/success/error states |
| `js/portfolio.js` | Category filter logic, lightbox open/close/prev/next, keyboard nav, focus trap |
| `js/blog-preview.js` | Fetches `posts.json` and renders 3 most recent posts on the homepage |
| `js/blog.js` | Blog listing page — filter by category, paginated load-more (6 per page) |
| `js/blog-post.js` | Single post page — reads `?slug=` param, fetches post from `posts.json`, renders HTML body |
| `js/admin.js` | Full blog CMS — auth, encryption, GitHub API read/write, post editor, publish/discard flow |
| `js/admin-knock.js` | Secret knock — 5 clicks on footer copyright within 3 seconds navigates to `admin.html` |

---

## CSS

| File | Purpose |
|---|---|
| `css/variables.css` | Design tokens — colors, spacing, typography, radius, transitions |
| `css/base.css` | Reset, global element styles, utility classes |
| `css/layout.css` | Section wrappers, grid containers, responsive breakpoints |
| `css/components.css` | All component styles — nav, hero, cards, forms, lightbox, marquee, etc. |
| `css/portfolio.css` | Portfolio-specific grid and lightbox styles |
| `css/blog.css` | Blog listing, blog post, and admin CMS styles |
| `css/legal.css` | Privacy and accessibility page styles |
| `css/admin.css` | Admin panel layout and UI styles |

---

## Design System

- **Theme:** Dark — `#111111` background, `#1c1c1c` card surfaces
- **Accent:** SCV yellow `#F5B800` — CTAs, highlights, active states, hover effects
- **Typography:** White on dark; muted gray `#888888` for secondary text
- **Nav:** Transparent at top, frosted glass after 20px scroll; always frosted on portfolio/legal/blog pages
- **Animations:** Reveal class + IntersectionObserver for fade-in-up on scroll
- **Buttons:** `.btn-primary` (yellow fill) / `.btn-outline` (bordered)

---

## Key Technical Notes

- **Formspree CAPTCHA must be disabled** — AJAX submissions don't send a CAPTCHA token; Formshield ML spam filtering is used instead
- **Team photos:** `object-fit: contain` (not cover) — yellow ring is baked into headshot images
- **Trust strip logos:** CSS `filter: brightness(0) invert(1)` for white — except Howard Hanna which uses the color `-better.webp` version
- **`[hidden]` override** in `base.css` — required for lightbox show/hide to work correctly
- **No border-radius on team photos** — causes double-ring artifact with baked-in yellow ring
- **Admin branch constant** — `BRANCH` in `admin.js` must match the deployed branch (update to `main` after Blog branch is merged)

---

## Asset Structure

```
assets/images/
├── brand/          — logo-white.png, logo-white-full.png, logo-gold.png, favicon.png
├── partners/       — trust strip client logos (10 brands)
├── team/           — headshots for all 6 team members
├── portfolio/
│   ├── aerial/     — 17 aerial drone shots
│   └── real-estate/ — 2 real estate interior/exterior shots
├── blog/           — blog post cover images and inline images
└── site/
    └── about-bg.jpg — Pittsburgh golden hour background
```

---

## Data Files

| File | Purpose |
|---|---|
| `blog/posts.json` | All blog post data — source of truth for listing, single post, and homepage preview |
| `CNAME` | Custom domain record for GitHub Pages (`steelcityvisuals.com`) |

---

## Contact Info

- Email: team@steelcityvisuals.com
- Address: 842 East Ohio Street, Pittsburgh, PA 15212
- Booking: portal.steelcityvisuals.com/book
