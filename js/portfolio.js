// ── Portfolio: data fetch + render + filter + lightbox ──

(async function () {

  const ZOOM_SVG =
    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">` +
    `<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;

  // ── Fetch + render ─────────────────────────────────────────────────────────

  let portfolioData;
  try {
    const res = await fetch('data/portfolio.json');
    if (!res.ok) throw new Error(`Failed to load portfolio.json (${res.status})`);
    portfolioData = await res.json();
    window._portfolioData = portfolioData; // exposed for portfolio-admin.js
  } catch (err) {
    console.error(err);
    return;
  }

  // Update portfolio hero text
  const heroLabel = document.querySelector('.portfolio-hero .section-label');
  const heroTitle = document.querySelector('.portfolio-hero__title');
  const heroSub   = document.querySelector('.portfolio-hero__sub');
  if (heroLabel) heroLabel.textContent = portfolioData.page.label;
  if (heroTitle) heroTitle.textContent = portfolioData.page.headline;
  if (heroSub)   heroSub.textContent   = portfolioData.page.subheadline;

  // Render portfolio grid
  const grid = document.getElementById('portfolio-grid');
  if (!grid) return;

  // Build category label map from data (fallback for legacy JSON without categories)
  const rawCategories = portfolioData.categories || [
    { value: 'aerial',      label: 'Aerial'      },
    { value: 'real-estate', label: 'Real Estate'  },
    { value: 'wedding',     label: 'Wedding'      },
    { value: 'corporate',   label: 'Corporate'    },
  ];
  const CATEGORY_LABELS = {};
  rawCategories.forEach(c => { CATEGORY_LABELS[c.value] = c.label; });

  // Render filter buttons
  const filtersInner = document.getElementById('portfolio-filters-inner');
  if (filtersInner) {
    filtersInner.innerHTML =
      `<button class="portfolio-filter active" data-filter="all">All</button>` +
      rawCategories.map(c =>
        `<button class="portfolio-filter" data-filter="${c.value}">${c.label}</button>`
      ).join('');
  }

  grid.innerHTML = portfolioData.images.filter(img => img.visible !== false).map(img => {
    const catLabel = CATEGORY_LABELS[img.category] || img.category;
    return `<div class="portfolio-item" data-category="${img.category}">` +
      `<div class="portfolio-item__inner">` +
        `<img src="${img.src}" alt="${img.alt}" class="portfolio-item__img" loading="lazy" />` +
        `<div class="portfolio-item__overlay">` +
          `<div class="portfolio-item__info">` +
            `<div class="portfolio-item__category">${catLabel}</div>` +
            `<div class="portfolio-item__title">${img.title}</div>` +
          `</div>` +
          `<div class="portfolio-item__zoom" aria-label="View full size">${ZOOM_SVG}</div>` +
        `</div>` +
      `</div>` +
    `</div>`;
  }).join('');

  // Signal portfolio-admin.js that the grid is ready
  window._portfolioReady = true;
  document.dispatchEvent(new CustomEvent('portfolio:ready'));

  // ── Filter ────────────────────────────────────────────────────────────────

  const filters  = document.querySelectorAll('.portfolio-filter');
  const items    = document.querySelectorAll('.portfolio-item');
  const emptyMsg = document.getElementById('portfolio-empty');

  filters.forEach(btn => {
    btn.addEventListener('click', () => {
      filters.forEach(f => f.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      let visible = 0;

      items.forEach(item => {
        const match = filter === 'all' || item.dataset.category === filter;
        item.classList.toggle('hidden', !match);
        if (match) visible++;
      });

      // Span first visible item across two columns
      const visibleItems = [...items].filter(i => !i.classList.contains('hidden'));
      items.forEach(i => i.style.gridColumn = '');
      if (visibleItems.length > 0) {
        visibleItems[0].style.gridColumn = visibleItems.length > 1 ? 'span 2' : 'span 1';
      }

      emptyMsg.hidden = visible > 0;
    });
  });

  // ── Lightbox ──────────────────────────────────────────────────────────────

  const lightbox  = document.getElementById('lightbox');
  const backdrop  = document.getElementById('lightbox-backdrop');
  const lbImg     = document.getElementById('lightbox-img');
  const lbCaption = document.getElementById('lightbox-caption');
  const closeBtn  = document.getElementById('lightbox-close');
  const prevBtn   = document.getElementById('lightbox-prev');
  const nextBtn   = document.getElementById('lightbox-next');

  let currentIndex = 0;
  let activeItems  = [];
  let triggerEl    = null;

  const focusableEls = [closeBtn, prevBtn, nextBtn];

  function getActiveItems() {
    return [...items].filter(i => !i.classList.contains('hidden'));
  }

  function showImage(index) {
    const item  = activeItems[index];
    const img   = item.querySelector('.portfolio-item__img');
    const title = item.querySelector('.portfolio-item__title')?.textContent || '';
    const cat   = item.querySelector('.portfolio-item__category')?.textContent || '';

    lbImg.src             = img.src;
    lbImg.alt             = img.alt;
    lbCaption.textContent = cat ? `${cat} — ${title}` : title;

    prevBtn.style.opacity = index === 0 ? '0.3' : '1';
    nextBtn.style.opacity = index === activeItems.length - 1 ? '0.3' : '1';
  }

  function openLightbox(index, trigger) {
    activeItems  = getActiveItems();
    currentIndex = index;
    triggerEl    = trigger || null;
    showImage(currentIndex);
    lightbox.hidden = false;
    backdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    backdrop.hidden = true;
    document.body.style.overflow = '';
    if (triggerEl) triggerEl.focus();
  }

  function prev() {
    if (currentIndex > 0) { currentIndex--; showImage(currentIndex); }
  }

  function next() {
    if (currentIndex < activeItems.length - 1) { currentIndex++; showImage(currentIndex); }
  }

  items.forEach(item => {
    item.addEventListener('click', () => {
      const visibleItems = getActiveItems();
      const visibleIndex = visibleItems.indexOf(item);
      if (visibleIndex !== -1) openLightbox(visibleIndex, item);
    });
  });

  closeBtn.addEventListener('click', closeLightbox);
  backdrop.addEventListener('click', closeLightbox);
  prevBtn.addEventListener('click', (e) => { e.stopPropagation(); prev(); });
  nextBtn.addEventListener('click', (e) => { e.stopPropagation(); next(); });

  document.addEventListener('keydown', (e) => {
    if (lightbox.hidden) return;
    if (e.key === 'Escape')      { closeLightbox(); return; }
    if (e.key === 'ArrowLeft')   { prev(); return; }
    if (e.key === 'ArrowRight')  { next(); return; }
    if (e.key === 'Tab') {
      const first = focusableEls[0];
      const last  = focusableEls[focusableEls.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    }
  });

})();
