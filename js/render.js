// ── SCV Render — builds index.html from JSON data files ──
// Fetches all data in parallel, renders every section, then fires
// the 'scv:ready' event so animations.js and contact.js can initialize.
//
// data-* attributes on text elements are used by admin.js to enable
// inline editing. Format: data-file="data/x.json" data-path="a.b[0].c"

(async function () {

  const isAdminMode = new URLSearchParams(location.search).get('mode') === 'admin';

  // ── SVG helpers ──────────────────────────────────────────────────────────

  const arrowSvg = (size) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 14 14" fill="none" aria-hidden="true">` +
    `<path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;

  const linkedInSvg =
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">` +
    `<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>` +
    `</svg>`;

  const SERVICE_ICONS = {
    'real-estate':
      `<path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<path d="M9 21V12h6v9" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`,
    branding:
      `<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>` +
      `<path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
    wedding:
      `<path d="M12 21C12 21 4 14.5 4 9a8 8 0 0116 0c0 5.5-8 12-8 12z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<circle cx="12" cy="9" r="2.5" stroke="currentColor" stroke-width="1.8"/>`,
    aerial:
      `<path d="M12 2L8 7H4l2 4-4 2 4 2-2 4h4l4 5 4-5h4l-2-4 4-2-4-2 2-4h-4l-4-5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`,
    corporate:
      `<rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/>` +
      `<path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<path d="M12 12v3M10.5 13.5h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
    'social-media':
      `<path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`,
  };
  window._scvServiceIcons = SERVICE_ICONS;

  const CONTACT_SOCIAL_ICONS = {
    LinkedIn:
      `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">` +
      `<path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>` +
      `<circle cx="4" cy="4" r="2" fill="currentColor"/></svg>`,
    Facebook:
      `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">` +
      `<path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>`,
    Instagram:
      `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">` +
      `<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>` +
      `<circle cx="12" cy="12" r="4"/>` +
      `<circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>`,
  };

  const FOOTER_SOCIAL_ICONS = {
    LinkedIn:
      `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">` +
      `<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>` +
      `</svg>`,
    Facebook:
      `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">` +
      `<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>` +
      `</svg>`,
    Instagram:
      `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">` +
      `<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>` +
      `</svg>`,
  };

  // ── Section renderers ─────────────────────────────────────────────────────

  function renderNav(nav) {
    const linksList = document.querySelector('.nav__links');
    const ctaWrap   = document.querySelector('.nav__cta');
    const mobileEl  = document.querySelector('.nav__mobile');

    if (linksList) {
      linksList.innerHTML = nav.links.map((link, i) =>
        `<li><a href="${link.href}"` +
        ` data-btn-file="data/site.json"` +
        ` data-btn-text-path="nav.links[${i}].label"` +
        ` data-btn-href-path="nav.links[${i}].href"` +
        ` data-nav-i="${i}">` +
        `<span class="btn-label">${link.label}</span>` +
        `</a></li>`
      ).join('');
    }

    if (ctaWrap) {
      ctaWrap.innerHTML =
        `<a href="${nav.cta.href}" target="_blank" rel="noopener" class="btn btn-primary"` +
        ` data-btn-file="data/site.json"` +
        ` data-btn-text-path="nav.cta.label"` +
        ` data-btn-href-path="nav.cta.href"` +
        ` data-nav-cta>` +
        `<span class="btn-label">${nav.cta.label}</span> ${arrowSvg(14)}` +
        `</a>`;
    }

    if (mobileEl) {
      mobileEl.innerHTML =
        nav.links.map((link, i) =>
          `<a href="${link.href}" data-nav-mobile-i="${i}">` +
          `<span class="btn-label">${link.label}</span>` +
          `</a>`
        ).join('') +
        `<a href="${nav.cta.href}" target="_blank" rel="noopener"` +
        ` class="btn btn-primary" data-nav-mobile-cta>` +
        `<span class="btn-label">${nav.cta.label}</span>` +
        `</a>`;
    }
  }

  function renderHero(hero) {
    const el = document.getElementById('hero');
    if (!el) return;

    // Badges with data-badge-index for admin editing
    const badges = hero.badges.map((b, i) =>
      `<span class="hero__badge" data-badge-index="${i}">${b}</span>` +
      (i < hero.badges.length - 1 ? `<span class="hero__badge-dot"></span>` : '')
    ).join('');

    el.innerHTML =
      `<div class="hero__bg" style="background-image: url('${hero.backgroundImage}');"></div>` +
      `<div class="hero__overlay"></div>` +
      `<div class="container hero__content">` +
        `<div class="hero__badges reveal">${badges}</div>` +
        `<h1 class="hero__headline reveal reveal-delay-1">` +
          // hero__hl1 span lets admin.js target line1 independently of the accent
          `<span class="hero__hl1">${hero.headlineLine1}</span><br />` +
          `<span class="hero__headline-accent">${hero.headlineAccent}</span>` +
        `</h1>` +
        `<p class="hero__sub reveal reveal-delay-2">${hero.subheadline}</p>` +
        `<div class="hero__ctas reveal reveal-delay-3">` +
          `<a href="${hero.ctaPrimary.href}" target="_blank" rel="noopener" class="btn btn-primary btn-lg" data-btn-file="data/site.json" data-btn-text-path="hero.ctaPrimary.text" data-btn-href-path="hero.ctaPrimary.href">` +
            `<span class="btn-label">${hero.ctaPrimary.text}</span> ${arrowSvg(16)}` +
          `</a>` +
          `<a href="${hero.ctaSecondary.href}" class="btn btn-outline btn-lg" data-btn-file="data/site.json" data-btn-text-path="hero.ctaSecondary.text" data-btn-href-path="hero.ctaSecondary.href"><span class="btn-label">${hero.ctaSecondary.text}</span></a>` +
        `</div>` +
      `</div>` +
      `<div class="hero__scroll" aria-hidden="true"><span></span></div>`;
  }

  function renderTrust(partners) {
    const el = document.getElementById('trust');
    if (!el) return;

    if (isAdminMode) {
      const items = partners.map((p, i) =>
        `<div class="trust__admin-item" data-partner-index="${i}">` +
          `<img src="${p.src}" alt="${p.name}" class="trust__logo${p.tall ? ' trust__logo--tall' : ''}" />` +
          `<span class="trust__admin-name">${p.name}</span>` +
        `</div>`
      ).join('');
      el.innerHTML =
        `<div class="trust__label">Trusted by industry leaders</div>` +
        `<div class="trust__admin-grid" id="trust-admin-grid">` +
          items +
          `<div class="trust__admin-add" id="trust-add-btn">` +
            `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>` +
            `<span>Add Logo</span>` +
          `</div>` +
        `</div>`;
    } else {
      const logos = (hidden) => partners.map(p =>
        `<img src="${p.src}" alt="${p.name}" ` +
        `class="trust__logo${p.tall ? ' trust__logo--tall' : ''}"` +
        `${hidden ? ' aria-hidden="true"' : ''} />`
      ).join('');
      el.innerHTML =
        `<div class="trust__label">Trusted by industry leaders</div>` +
        `<div class="trust__track-wrapper">` +
          `<div class="trust__track">${logos(false)}${logos(true)}</div>` +
        `</div>`;
    }
  }

  function renderServices(services) {
    const el = document.getElementById('services');
    if (!el) return;
    const delays = ['reveal-delay-1', 'reveal-delay-2', 'reveal-delay-3', 'reveal-delay-4', 'reveal-delay-5'];

    // Iterate full cards array to preserve JSON index for admin editing
    let visibleDelay = 0;
    const cardHtml = services.cards.map((card, jsonIndex) => {
      if (!card.visible) return '';
      const delay = delays[visibleDelay++] || '';
      return `<div class="services__card reveal ${delay}" data-card-json-index="${jsonIndex}">` +
        `<div class="services__card-icon">` +
          `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">` +
            (SERVICE_ICONS[card.id] || '') +
          `</svg>` +
        `</div>` +
        `<h3 class="services__card-title">${card.title}</h3>` +
        `<p class="services__card-desc">${card.description}</p>` +
      `</div>`;
    }).join('');

    el.innerHTML =
      `<div class="container">` +
        `<div class="services__header reveal">` +
          `<span class="section-label">${services.header.label}</span>` +
          `<h2 class="section-title">${services.header.title}</h2>` +
          `<p class="section-subtitle">${services.header.subtitle}</p>` +
        `</div>` +

        `<div class="services__featured reveal reveal-delay-1">` +
          `<div class="services__featured-icon">` +
            `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true" data-featured-icon>` +
              (SERVICE_ICONS[services.featured.iconId] || SERVICE_ICONS['real-estate']) +
            `</svg>` +
          `</div>` +
          `<div class="services__featured-content">` +
            `<div class="services__featured-tag">${services.featured.tag}</div>` +
            `<h3 class="services__featured-title">${services.featured.title}</h3>` +
            `<p class="services__featured-desc">${services.featured.description}</p>` +
            `<ul class="services__featured-list">` +
              // data-fi-index for each include item
              services.featured.includes.map((item, i) => `<li data-fi-index="${i}">${item}</li>`).join('') +
            `</ul>` +
          `</div>` +
        `</div>` +

        `<div class="services__grid">${cardHtml}</div>` +
      `</div>`;
  }

  function renderPricing(pricing) {
    const el = document.getElementById('pricing');
    if (!el) return;
    const cardDelays = ['reveal-delay-1', 'reveal-delay-2', 'reveal-delay-3', 'reveal-delay-4'];

    const reBlock = pricing.realEstate.visible
      ? `<div class="pricing__category reveal">` +
          `<h3 class="pricing__category-title" data-pricing-re-title>${pricing.realEstate.title || 'Real Estate Marketing'}</h3>` +
        `</div>` +
        `<div class="pricing__re-block reveal">` +
          `<div class="pricing__re-left">` +
            `<div class="pricing__re-label">${pricing.realEstate.label}</div>` +
            `<p class="pricing__re-desc">${pricing.realEstate.description}</p>` +
            `<ul class="pricing__re-includes">` +
              // data-rei-index for each include item
              pricing.realEstate.includes.map((item, i) => `<li data-rei-index="${i}">${item}</li>`).join('') +
            `</ul>` +
          `</div>` +
          `<div class="pricing__re-right">` +
            `<div class="pricing__re-cta-label">${pricing.realEstate.ctaLabel}</div>` +
            `<div class="pricing__re-cta-sub">${pricing.realEstate.ctaSub}</div>` +
            `<a href="${pricing.realEstate.ctaHref}" target="_blank" rel="noopener" class="btn btn-primary btn-lg" data-btn-file="data/pricing.json" data-btn-text-path="realEstate.ctaText" data-btn-href-path="realEstate.ctaHref">` +
              `<span class="btn-label">${pricing.realEstate.ctaText}</span> ${arrowSvg(16)}` +
            `</a>` +
            `<div class="pricing__re-note">${pricing.realEstate.ctaNote}</div>` +
          `</div>` +
        `</div>`
      : '';

    const smBlock = pricing.socialMedia.visible
      ? `<div class="pricing__category reveal">` +
          `<h3 class="pricing__category-title">Social Media Marketing</h3>` +
        `</div>` +
        `<div class="pricing__social reveal">` +
          `<div class="pricing__social-left">` +
            `<div class="pricing__re-label">${pricing.socialMedia.label}</div>` +
            `<p class="pricing__re-desc">${pricing.socialMedia.description}</p>` +
            `<ul class="pricing__re-includes">` +
              pricing.socialMedia.includes.map(item => `<li>${item}</li>`).join('') +
            `</ul>` +
          `</div>` +
          `<div class="pricing__social-right">` +
            `<div class="pricing__re-cta-label">${pricing.socialMedia.ctaLabel}</div>` +
            `<div class="pricing__re-cta-sub">${pricing.socialMedia.ctaSub}</div>` +
            `<a href="${pricing.socialMedia.ctaHref}" class="btn btn-primary"` +
              ` data-btn-file="data/pricing.json"` +
              ` data-btn-text-path="socialMedia.ctaText"` +
              ` data-btn-href-path="socialMedia.ctaHref">` +
              `<span class="btn-label">${pricing.socialMedia.ctaText}</span> ${arrowSvg(14)}` +
            `</a>` +
          `</div>` +
        `</div>`
      : '';

    el.innerHTML =
      `<div class="container">` +
        `<div class="pricing__header reveal">` +
          `<span class="section-label">${pricing.header.label}</span>` +
          `<h2 class="section-title">${pricing.header.title}</h2>` +
          `<p class="section-subtitle">${pricing.header.subtitle}</p>` +
        `</div>` +
        reBlock +
        smBlock +
        `<div class="pricing__category reveal">` +
          `<h3 class="pricing__category-title" data-pricing-other-title>${pricing.otherServices.title}</h3>` +
          `<p class="pricing__category-sub" data-pricing-other-sub>${pricing.otherServices.subtitle}</p>` +
        `</div>` +
        `<div class="pricing__other reveal" id="pricing-other-grid">` +
          // data-other-index for each other-service card
          pricing.otherServices.cards.map((card, i) => {
            const external = card.linkHref.startsWith('http');
            return `<div class="pricing__other-card reveal ${cardDelays[i] || ''}" data-other-index="${i}">` +
              `<div class="pricing__other-name">${card.name}</div>` +
              `<div class="pricing__other-price">${card.price}</div>` +
              `<div class="pricing__other-desc">${card.description}</div>` +
              `<a href="${card.linkHref}"${external ? ' target="_blank" rel="noopener"' : ''}` +
              ` class="pricing__other-link"` +
              ` data-btn-file="data/pricing.json"` +
              ` data-btn-text-path="otherServices.cards[${i}].linkText"` +
              ` data-btn-href-path="otherServices.cards[${i}].linkHref">` +
              `<span class="btn-label">${card.linkText}</span></a>` +
            `</div>`;
          }).join('') +
        `</div>` +
      `</div>`;
  }

  function renderStats(stats) {
    const el = document.getElementById('stats');
    if (!el) return;
    const delays = ['', 'reveal-delay-1', 'reveal-delay-2', 'reveal-delay-3'];

    el.innerHTML =
      `<div class="container">` +
        `<div class="stats__grid">` +
          // data-stat-index for each stat item
          stats.map((stat, i) =>
            `<div class="stats__item reveal ${delays[i] || ''}" data-stat-index="${i}">` +
              `<div class="stats__number">` +
                `<span class="stats__count" data-target="${stat.target}" data-prefix="${stat.prefix}" data-suffix="${stat.suffix}">0</span>` +
              `</div>` +
              `<div class="stats__label">${stat.label}</div>` +
              `<div class="stats__sub">${stat.sub}</div>` +
            `</div>`
          ).join('') +
        `</div>` +
      `</div>`;
  }

  function renderAbout(about, team) {
    const el = document.getElementById('about');
    if (!el) return;

    // data-team-index for each team card
    const teamCards = team.map((member, i) => {
      const delay = `reveal-delay-${(i % 4) + 1}`;
      return `<div class="team__card reveal ${delay}" data-team-index="${i}">` +
        `<div class="team__photo-wrap">` +
          `<img src="${member.photo}" alt="${member.name}" class="team__photo" />` +
        `</div>` +
        `<div class="team__info">` +
          `<h3 class="team__name">${member.name}</h3>` +
          `<div class="team__title">${member.title}</div>` +
          `<p class="team__bio">${member.bio}</p>` +
          `<a href="${member.linkedin}" target="_blank" rel="noopener" class="team__linkedin" aria-label="${member.name} on LinkedIn"` +
            ` data-btn-file="data/team.json" data-btn-href-path="[${i}].linkedin">` +
            linkedInSvg + ` LinkedIn` +
          `</a>` +
        `</div>` +
      `</div>`;
    }).join('');

    el.innerHTML =
      `<div class="container">` +
        `<div class="about__split">` +
          `<div class="about__image-wrap reveal">` +
            `<img src="${about.image}" alt="${about.imageAlt}" class="about__image" />` +
          `</div>` +
          `<div class="about__content reveal reveal-delay-1">` +
            `<span class="section-label">About Us</span>` +
            // Two named spans so admin.js can target each headline line independently
            `<h2 class="section-title">` +
              `<span class="about__hl1">${about.headlineLine1}</span><br />` +
              `<span class="about__hl2">${about.headlineLine2}</span>` +
            `</h2>` +
            // data-body-index for each body paragraph
            about.body.map((p, i) => `<p class="about__body" data-body-index="${i}">${p}</p>`).join('') +
            `<div class="about__pillars">` +
              // data-pillar-index for each pillar
              about.pillars.map((p, i) =>
                `<div class="about__pillar" data-pillar-index="${i}">` +
                  `<div class="about__pillar-icon">&#9654;</div>` +
                  `<div>` +
                    `<div class="about__pillar-title">${p.title}</div>` +
                    `<div class="about__pillar-sub">${p.sub}</div>` +
                  `</div>` +
                `</div>`
              ).join('') +
            `</div>` +
          `</div>` +
        `</div>` +
        `<div class="team">` +
          `<div class="team__header reveal">` +
            `<span class="section-label" data-team-label>${about.teamLabel || 'The People Behind the Lens'}</span>` +
            `<h2 class="section-title" data-team-title>${about.teamTitle || 'Meet the Team'}</h2>` +
          `</div>` +
          `<div class="team__grid" id="team-grid">${teamCards}</div>` +
        `</div>` +
      `</div>`;
  }

  function renderTestimonials(testimonials, header = {}) {
    const el = document.getElementById('testimonials');
    if (!el) return;

    const label = header.label || 'Client Stories';
    const title = header.title || 'What Our Clients Say';

    const headerHtml =
      `<div class="container">` +
        `<div class="testimonials__header reveal">` +
          `<span class="section-label" data-testi-label>${label}</span>` +
          `<h2 class="section-title" data-testi-title>${title}</h2>` +
        `</div>` +
      `</div>`;

    if (isAdminMode) {
      // Flat grid — all cards visible, no marquee, all have data-testi-index
      const card = (t, i) =>
        `<div class="testimonials__card" data-testi-index="${i}">` +
          `<div class="testimonials__stars" aria-label="5 out of 5 stars">★★★★★</div>` +
          `<blockquote class="testimonials__quote">"${t.quote}"</blockquote>` +
          `<div class="testimonials__author">` +
            `<div class="testimonials__name">${t.name}</div>` +
            `<div class="testimonials__role">${t.role}</div>` +
          `</div>` +
        `</div>`;

      el.innerHTML =
        headerHtml +
        `<div class="container">` +
          `<div class="testimonials__admin-grid" id="testimonials-grid">` +
            testimonials.map((t, i) => card(t, i)).join('') +
          `</div>` +
        `</div>`;
    } else {
      // Normal marquee — two rows, each duplicated for seamless loop
      const row1 = testimonials.filter(t => t.row === 1);
      const row2 = testimonials.filter(t => t.row === 2);

      const card = (t, hidden, absIndex) =>
        `<div class="testimonials__card"${hidden ? ' aria-hidden="true"' : ` data-testi-index="${absIndex}"`}>` +
          `<div class="testimonials__stars"${hidden ? '' : ' aria-label="5 out of 5 stars"'}>★★★★★</div>` +
          `<blockquote class="testimonials__quote">"${t.quote}"</blockquote>` +
          `<div class="testimonials__author">` +
            `<div class="testimonials__name">${t.name}</div>` +
            `<div class="testimonials__role">${t.role}</div>` +
          `</div>` +
        `</div>`;

      el.innerHTML =
        headerHtml +
        `<div class="testimonials__marquee-wrap">` +
          `<div class="testimonials__track testimonials__track--fwd">` +
            row1.map((t, i) => card(t, false, i)).join('') +
            row1.map(t => card(t, true)).join('') +
          `</div>` +
          `<div class="testimonials__track testimonials__track--rev">` +
            row2.map((t, i) => card(t, false, row1.length + i)).join('') +
            row2.map(t => card(t, true)).join('') +
          `</div>` +
        `</div>`;
    }
  }

  function renderContact(contact) {
    const el = document.getElementById('contact');
    if (!el) return;

    // Address lines as individual spans with data-addr-index
    const addressHtml = contact.address
      .map((line, i) => `<span class="addr-line" data-addr-index="${i}">${line}</span>`)
      .join('<br />');

    el.innerHTML =
      `<div class="container">` +
        `<div class="contact__inner">` +
          `<div class="contact__info reveal">` +
            `<span class="section-label">${contact.label}</span>` +
            `<h2 class="section-title">${contact.headline}</h2>` +
            `<p class="contact__intro">${contact.intro}</p>` +
            `<div class="contact__details">` +
              `<div class="contact__detail">` +
                `<div class="contact__detail-icon">` +
                  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">` +
                    `<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>` +
                    `<circle cx="12" cy="9" r="2.5" stroke="currentColor" stroke-width="1.8"/>` +
                  `</svg>` +
                `</div>` +
                `<div>` +
                  `<div class="contact__detail-label">Office</div>` +
                  `<div class="contact__detail-value">${addressHtml}</div>` +
                `</div>` +
              `</div>` +
              `<div class="contact__detail">` +
                `<div class="contact__detail-icon">` +
                  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">` +
                    `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>` +
                    `<path d="M22 6l-10 7L2 6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>` +
                  `</svg>` +
                `</div>` +
                `<div>` +
                  `<div class="contact__detail-label">Email</div>` +
                  `<a href="mailto:${contact.email}" class="contact__detail-value contact__detail-link" data-contact-email>${contact.email}</a>` +
                `</div>` +
              `</div>` +
            `</div>` +
            `<div class="contact__socials">` +
              contact.socials.map((s, i) =>
                `<a href="${s.href}" target="_blank" rel="noopener" class="contact__social-link" aria-label="${s.label}" data-btn-file="data/site.json" data-btn-href-path="contact.socials[${i}].href">` +
                  (CONTACT_SOCIAL_ICONS[s.name] || '') + ` ${s.name}` +
                `</a>`
              ).join('') +
            `</div>` +
            `<a href="${contact.bookingHref}" target="_blank" rel="noopener" class="btn btn-primary btn-lg contact__book-btn" data-btn-file="data/site.json" data-btn-href-path="contact.bookingHref">` +
              `Book Real Estate Directly ${arrowSvg(16)}` +
            `</a>` +
          `</div>` +

          `<div class="contact__form-wrap reveal reveal-delay-2">` +
            `<form class="contact__form" id="contact-form" action="${contact.formAction}" method="POST">` +
              `<div class="contact__form-row">` +
                `<div class="contact__field">` +
                  `<label for="first-name" class="contact__label">First Name</label>` +
                  `<input type="text" id="first-name" name="first-name" class="contact__input" placeholder="John" required />` +
                `</div>` +
                `<div class="contact__field">` +
                  `<label for="last-name" class="contact__label">Last Name</label>` +
                  `<input type="text" id="last-name" name="last-name" class="contact__input" placeholder="Smith" required />` +
                `</div>` +
              `</div>` +
              `<div class="contact__field">` +
                `<label for="email" class="contact__label">Email</label>` +
                `<input type="email" id="email" name="email" class="contact__input" placeholder="john@example.com" required />` +
              `</div>` +
              `<div class="contact__field">` +
                `<label for="service" class="contact__label">Service</label>` +
                `<select id="service" name="service" class="contact__input contact__select">` +
                  `<option value="" disabled selected>What can we help you with?</option>` +
                  `<option value="real-estate">Real Estate Marketing</option>` +
                  `<option value="branding">Branding</option>` +
                  `<option value="wedding">Premium Wedding Imagery</option>` +
                  `<option value="drone">Aerial Drone Photography</option>` +
                  `<option value="corporate">Corporate</option>` +
                  `<option value="other">Other</option>` +
                `</select>` +
              `</div>` +
              `<div class="contact__field">` +
                `<label for="message" class="contact__label">Message</label>` +
                `<textarea id="message" name="message" class="contact__input contact__textarea" placeholder="Tell us about your project..." rows="5"></textarea>` +
              `</div>` +
              `<button type="submit" class="btn btn-primary btn-lg contact__submit">` +
                `Send Message ${arrowSvg(16)}` +
              `</button>` +
            `</form>` +
            `<div class="contact__success" id="contact-success" hidden>` +
              `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">` +
                `<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8"/>` +
                `<path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>` +
              `</svg>` +
              `<h3>Message Sent!</h3>` +
              `<p>Thanks for reaching out — we'll get back to you within one business day.</p>` +
            `</div>` +
          `</div>` +
        `</div>` +
      `</div>`;
  }

  function renderFooter(contact, footer) {
    const el = document.querySelector('footer.footer');
    if (!el) return;

    el.innerHTML =
      `<div class="container">` +
        `<div class="footer__top">` +
          `<div class="footer__brand">` +
            `<img src="assets/images/brand/logo-white.png" alt="Steel City Visuals" class="footer__logo" />` +
            `<p class="footer__tagline">${footer.tagline}</p>` +
            `<div class="footer__socials">` +
              contact.socials.map((s, i) =>
                `<a href="${s.href}" target="_blank" rel="noopener" aria-label="${s.label}" data-btn-file="data/site.json" data-btn-href-path="contact.socials[${i}].href">` +
                  (FOOTER_SOCIAL_ICONS[s.name] || s.name) +
                `</a>`
              ).join('') +
            `</div>` +
          `</div>` +
          `<div>` +
            `<p class="footer__heading">Navigate</p>` +
            `<ul class="footer__links">` +
              footer.links.map((link, i) => {
                const external = link.href.startsWith('http');
                return `<li><a href="${link.href}"` +
                  (external ? ` target="_blank" rel="noopener"` : '') +
                  ` data-btn-file="data/site.json"` +
                  ` data-btn-text-path="footer.links[${i}].label"` +
                  ` data-btn-href-path="footer.links[${i}].href">` +
                  `<span class="btn-label">${link.label}</span>` +
                  `</a></li>`;
              }).join('') +
            `</ul>` +
          `</div>` +
          `<div class="footer__contact">` +
            `<p class="footer__heading">Contact</p>` +
            contact.address.map((line, i) => `<p data-footer-addr-index="${i}">${line}</p>`).join('') +
            `<br /><a href="mailto:${contact.email}" class="footer__email">${contact.email}</a>` +
          `</div>` +
        `</div>` +
        `<div class="footer__bottom">` +
          `<p class="footer__copyright">${footer.copyright}</p>` +
          `<div style="display:flex; gap: var(--space-4);">` +
            `<a href="privacy.html">Privacy Policy</a>` +
            `<a href="accessibility.html">Accessibility Statement</a>` +
          `</div>` +
        `</div>` +
      `</div>`;
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  async function fetchJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`SCV: failed to load ${path} (${res.status})`);
    return res.json();
  }

  try {
    const [site, services, pricing, team, testimonials, partners] = await Promise.all([
      fetchJSON('data/site.json'),
      fetchJSON('data/services.json'),
      fetchJSON('data/pricing.json'),
      fetchJSON('data/team.json'),
      fetchJSON('data/testimonials.json'),
      fetchJSON('data/partners.json'),
    ]);

    renderNav(site.nav);
    renderHero(site.hero);
    renderTrust(partners);
    renderServices(services);
    renderPricing(pricing);
    renderStats(site.stats);
    renderAbout(site.about, team);
    renderTestimonials(testimonials, site.testimonialsHeader);
    renderContact(site.contact);
    renderFooter(site.contact, site.footer);

    window._scvReady = true;
    document.dispatchEvent(new CustomEvent('scv:ready'));
  } catch (err) {
    console.error(err);
  }

})();
