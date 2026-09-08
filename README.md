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
| `campaign.html` | Marketing campaign landing page template — loaded by slug from `campaigns/campaigns.json`. Not linked from site nav; shareable only via direct URL. Also the template the admin clones to generate each campaign's static page (see Marketing Campaigns below) |
| `privacy.html` | Privacy Policy |
| `accessibility.html` | Accessibility Statement |
| `admin.html` | Password-protected admin — manage blog posts and marketing campaigns. Reached via the secret 5-click knock on the footer copyright, or directly at `/admin.html` |

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
Pittsburgh golden-hour background image with company story. Kyle is featured full-width at the top, followed by the rest of the team in a 3-column grid (2 rows):
- Kyle Jennings — Owner, Executive Producer
- Nicholas Colicchie — Real Estate Director, HR Manager
- Conner Kelly — Creative Director, Visual Media Producer
- Jessica Mastrean — Post Production & Motion Graphic Manager
- Jade Fuccaro — Graphic Design Specialist
- Kristi Sipes — Visual Media Producer
- Calissa Holder — Marketing Coordinator

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

The site includes a blog with category filtering, paginated listing, and individual post pages.

---

## Marketing Campaigns

Unlisted, shareable landing pages for marketing campaigns (e.g. a paid ad or a printed flyer pointing to `steelcityvisuals.com/triplepackage`). Not linked from site navigation — only reachable by whoever has the direct URL.

- **Source of truth:** `campaigns/campaigns.json` — name, slug, description, image, and an active/inactive flag per campaign.
- **Live page:** when a campaign is saved in the admin, it commits a real file to the repo at `/{slug}/index.html`, generated from the `campaign.html` template with the `<title>` and `<meta og:*>` tags baked in directly (not just set via JS) so link-preview crawlers on iMessage/Slack/Facebook — which don't execute JavaScript — render the right title, description, and image. The page body itself is still rendered client-side by `js/campaign.js`, which fetches `campaigns.json` by slug, so editing a campaign's copy only requires re-saving in the admin (which regenerates the file).
- **Inactive campaigns:** the generated page still exists, but shows a "Campaign Ended" state instead of the offer.
- **Renaming a slug:** the admin deletes the old `/{old-slug}/index.html` and creates the new one automatically.
- **Reserved slugs:** campaign slugs can't collide with existing top-level site paths (`blog`, `admin`, `assets`, `css`, `js`, etc.) — enforced in `js/admin.js`.

---

## Admin

Password-protected, client-side-only admin at `admin.html` — manages both blog posts and marketing campaigns. There is no backend: the page authenticates locally (PBKDF2 password hash) and then commits directly to this repo via the GitHub Contents API, using a Personal Access Token the user generates once and stores encrypted in `localStorage`. The same token covers both blog posts and campaigns since it has full `repo` scope.

| File | Purpose |
|---|---|
| `js/admin.js` | Auth, GitHub API calls, blog post CRUD, campaign CRUD, static campaign-page generation |
| `css/admin.css` | Admin-only styling — separate from the public site's design system |

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
| `js/campaign.js` | Campaign landing page — resolves slug from `?slug=` or the URL path, fetches `campaigns.json`, renders content, handles the contact form |

---

## CSS

| File | Purpose |
|---|---|
| `css/variables.css` | Design tokens — colors, spacing, typography, radius, transitions |
| `css/base.css` | Reset, global element styles, utility classes |
| `css/layout.css` | Section wrappers, grid containers, responsive breakpoints |
| `css/components.css` | All component styles — nav, hero, cards, forms, lightbox, marquee, etc. |
| `css/portfolio.css` | Portfolio-specific grid and lightbox styles |
| `css/blog.css` | Blog listing and post styles |
| `css/campaign.css` | Marketing campaign landing page styles (reuses `blog.css`/`components.css` for the hero and contact form) |
| `css/legal.css` | Privacy and accessibility page styles |

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
├── campaigns/      — marketing campaign images
└── site/
    └── about-bg.jpg — Pittsburgh golden hour background
```

---

## Data Files

| File | Purpose |
|---|---|
| `blog/posts.json` | All blog post data — source of truth for listing, single post, and homepage preview |
| `campaigns/campaigns.json` | All marketing campaign data — source of truth for each campaign's generated `/{slug}/index.html` page |
| `CNAME` | Custom domain record for GitHub Pages (`steelcityvisuals.com`) |

---

## Contact Info

- Email: team@steelcityvisuals.com
- Address: 842 East Ohio Street, Pittsburgh, PA 15212
- Booking: portal.steelcityvisuals.com/book
