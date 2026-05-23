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

let currentIndex  = 0;
let activeItems   = [];
let triggerEl     = null; // element that opened the lightbox

const focusableEls = [closeBtn, prevBtn, nextBtn];

function getActiveItems() {
  return [...items].filter(i => !i.classList.contains('hidden'));
}

function openLightbox(index, trigger) {
  activeItems  = getActiveItems();
  currentIndex = index;
  triggerEl    = trigger || null;
  showImage(currentIndex);
  lightbox.hidden  = false;
  backdrop.hidden  = false;
  document.body.style.overflow = 'hidden';
  // Move focus into the lightbox
  closeBtn.focus();
}

function closeLightbox() {
  lightbox.hidden = true;
  backdrop.hidden = true;
  document.body.style.overflow = '';
  // Return focus to the item that opened the lightbox
  if (triggerEl) triggerEl.focus();
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
items.forEach((item) => {
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

// Keyboard navigation + focus trap
document.addEventListener('keydown', (e) => {
  if (lightbox.hidden) return;

  if (e.key === 'Escape') {
    closeLightbox();
    return;
  }

  if (e.key === 'ArrowLeft')  { prev(); return; }
  if (e.key === 'ArrowRight') { next(); return; }

  // Focus trap: cycle Tab within lightbox buttons
  if (e.key === 'Tab') {
    const first = focusableEls[0];
    const last  = focusableEls[focusableEls.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
});
