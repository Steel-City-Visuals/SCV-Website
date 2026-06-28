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
| `privacy.html` | Privacy Policy |
| `accessibility.html` | Accessibility Statement |

---

## Site Sections (index.html)

### Hero
Full-screen dark hero with SCV headline, subtext, and dual CTAs (Book Now → booking portal, View Our Work → portfolio). Parallax scroll effect on hero background.

### Trust Strip
Infinite auto-scrolling logo marquee of partner/client brands: Compass, eXp Realty, Coldwell Banker, Howard Hanna, Realty One Group, Charter Homes, HMA, Tenaris, Coca-Cola, Sotheby's.

### Services
Six service cards in a featured layout:
- **Real Estate Marketing** — full-width featured card (Most Popular)
- **Branding**, **Premium Wedding Imagery**, **Aerial Drone Photography**, **Corporate**, **Social Media Marketing** — 2+3 grid layout below

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

## JavaScript Features

| File | Features |
|---|---|
| `js/nav.js` | Transparent → frosted-glass nav on scroll, hamburger mobile menu toggle, back-to-top button |
| `js/animations.js` | IntersectionObserver scroll-reveal, stat count-up animation, hero parallax |
| `js/contact.js` | Formspree AJAX submission, loading/success/error states |
| `js/portfolio.js` | Category filter logic, lightbox open/close/prev/next, keyboard nav, focus trap |

---

## Design System

- **Theme:** Dark — `#111111` background, `#1c1c1c` card surfaces
- **Accent:** SCV yellow `#F5B800` — CTAs, highlights, active states, hover effects
- **Typography:** White on dark; muted gray `#888888` for secondary text
- **Nav:** Transparent at top, frosted glass after 20px scroll; always frosted on portfolio/legal pages
- **Animations:** Reveal class + IntersectionObserver for fade-in-up on scroll
- **Buttons:** `.btn-primary` (yellow fill) / `.btn-outline` (bordered)

---

## Key Technical Notes

- **Formspree CAPTCHA must be disabled** — AJAX submissions don't send a CAPTCHA token; Formshield ML spam filtering is used instead
- **Team photos:** `object-fit: contain` (not cover) — yellow ring is baked into headshot images
- **Trust strip logos:** CSS `filter: brightness(0) invert(1)` for white — except Howard Hanna which uses color
- **`[hidden]` override** in `base.css` — required for lightbox show/hide to work correctly
- **No border-radius on team photos** — causes double-ring artifact with baked-in yellow ring

---

## Asset Structure

```
assets/images/
├── brand/          — logo-white.png, logo-gold.png, favicon.png
├── partners/       — trust strip client logos
├── team/           — headshots for all 6 team members
├── portfolio/
│   ├── aerial/     — 17 aerial drone shots
│   └── real-estate/ — 2 real estate interior/exterior shots
└── site/
    └── about-bg.jpg — Pittsburgh golden hour background
```

---

## Contact Info

- Email: team@steelcityvisuals.com
- Address: 5800 Corporate Drive, Floor 3, Suites 307 & 308, Pittsburgh, PA 15237
- Booking: portal.steelcityvisuals.com/book
