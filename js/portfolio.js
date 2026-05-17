// ── Portfolio: Filter + Lightbox ──

// ── Filter ──
const filters   = document.querySelectorAll('.portfolio-filter');
const items     = document.querySelectorAll('.portfolio-item');
const emptyMsg  = document.getElementById('portfolio-empty');
const grid      = document.getElementById('portfolio-grid');

filters.forEach(btn => {
  btn.addEventListener('click', () => {
    // Update active button
    filters.forEach(f => f.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.dataset.filter;
    let visible = 0;

    items.forEach(item => {
      const match = filter === 'all' || item.dataset.category === filter;
      item.classList.toggle('hidden', !match);
      if (match) visible++;
    });

    // Reset first-child span when filtering
    const visibleItems = [...items].filter(i => !i.classList.contains('hidden'));
    items.forEach(i => i.style.gridColumn = '');
    if (visibleItems.length > 0) {
      visibleItems[0].style.gridColumn = visibleItems.length > 1 ? 'span 2' : 'span 1';
    }

    emptyMsg.hidden = visible > 0;
  });
});

// ── Lightbox ──
const lightbox   = document.getElementById('lightbox');
const backdrop   = document.getElementById('lightbox-backdrop');
const lbImg      = document.getElementById('lightbox-img');
const lbCaption  = document.getElementById('lightbox-caption');
const closeBtn   = document.getElementById('lightbox-close');
const prevBtn    = document.getElementById('lightbox-prev');
const nextBtn    = document.getElementById('lightbox-next');

let currentIndex = 0;
let activeItems  = [];

function getActiveItems() {
  return [...items].filter(i => !i.classList.contains('hidden'));
}

function openLightbox(index) {
  activeItems  = getActiveItems();
  currentIndex = index;
  showImage(currentIndex);
  lightbox.hidden  = false;
  backdrop.hidden  = false;
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.hidden = true;
  backdrop.hidden = true;
  document.body.style.overflow = '';
}

function showImage(index) {
  const item  = activeItems[index];
  const img   = item.querySelector('.portfolio-item__img');
  const title = item.querySelector('.portfolio-item__title')?.textContent || '';
  const cat   = item.querySelector('.portfolio-item__category')?.textContent || '';

  lbImg.src        = img.src;
  lbImg.alt        = img.alt;
  lbCaption.textContent = cat ? `${cat} — ${title}` : title;

  // Arrow visibility
  prevBtn.style.opacity = index === 0 ? '0.3' : '1';
  nextBtn.style.opacity = index === activeItems.length - 1 ? '0.3' : '1';
}

function prev() {
  if (currentIndex > 0) {
    currentIndex--;
    showImage(currentIndex);
  }
}

function next() {
  if (currentIndex < activeItems.length - 1) {
    currentIndex++;
    showImage(currentIndex);
  }
}

// Open on item click
items.forEach((item, i) => {
  item.addEventListener('click', () => {
    const visibleItems = getActiveItems();
    const visibleIndex = visibleItems.indexOf(item);
    if (visibleIndex !== -1) openLightbox(visibleIndex);
  });
});

closeBtn.addEventListener('click', closeLightbox);
backdrop.addEventListener('click', closeLightbox);
prevBtn.addEventListener('click', (e) => { e.stopPropagation(); prev(); });
nextBtn.addEventListener('click', (e) => { e.stopPropagation(); next(); });

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (lightbox.hidden) return;
  if (e.key === 'Escape')      closeLightbox();
  if (e.key === 'ArrowLeft')   prev();
  if (e.key === 'ArrowRight')  next();
});
