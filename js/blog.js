// ── Blog listing page ──

const POSTS_URL = 'blog/posts.json';
const PAGE_SIZE  = 6;

let allPosts     = [];
let filtered     = [];
let currentPage  = 0;
let activeFilter = 'All';

const grid        = document.getElementById('blog-grid');
const loadMoreBtn = document.getElementById('load-more-btn');
const loadMoreWrap = document.getElementById('blog-load-more');

// Format date: "2026-06-20" → "June 20, 2026"
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function buildCard(post) {
  const a = document.createElement('a');
  a.href = `blog-post.html?slug=${post.slug}`;
  a.className = 'blog-card';
  a.innerHTML = `
    <div class="blog-card__image-wrap">
      <img src="${post.image}" alt="${post.title}" class="blog-card__image" loading="lazy" />
    </div>
    <div class="blog-card__body">
      <span class="blog-card__category">${post.category}</span>
      <h2 class="blog-card__title">${post.title}</h2>
      <p class="blog-card__excerpt">${post.excerpt}</p>
      <div class="blog-card__meta">
        <span class="blog-card__author">${post.author}</span>
        <span class="blog-card__date">${formatDate(post.date)}</span>
      </div>
      <span class="blog-card__read-more">
        Read More
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    </div>
  `;
  return a;
}

function renderPage() {
  const start = 0;
  const end   = (currentPage + 1) * PAGE_SIZE;
  const slice = filtered.slice(start, end);

  grid.innerHTML = '';

  if (slice.length === 0) {
    grid.innerHTML = `
      <div class="blog-empty">
        <h3>No posts found</h3>
        <p>Try selecting a different category.</p>
      </div>`;
    loadMoreWrap.hidden = true;
    return;
  }

  slice.forEach(post => grid.appendChild(buildCard(post)));

  loadMoreWrap.hidden = filtered.length <= end;
}

function applyFilterAndSort() {
  const sortVal = document.getElementById('blog-sort').value;

  filtered = activeFilter === 'All'
    ? [...allPosts]
    : allPosts.filter(p => p.category === activeFilter);

  filtered.sort((a, b) => {
    return sortVal === 'oldest'
      ? new Date(a.date) - new Date(b.date)
      : new Date(b.date) - new Date(a.date);
  });

  currentPage = 0;
  renderPage();
}

// Category filter buttons
function initFilters(posts) {
  const categories = ['All', ...new Set(posts.map(p => p.category))];
  const container  = document.getElementById('blog-filters');

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className  = 'blog-filter-btn' + (cat === 'All' ? ' active' : '');
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      activeFilter = cat;
      container.querySelectorAll('.blog-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilterAndSort();
    });
    container.appendChild(btn);
  });
}

// Load More
if (loadMoreBtn) {
  loadMoreBtn.addEventListener('click', () => {
    currentPage++;
    renderPage();
  });
}

// Sort
const sortSelect = document.getElementById('blog-sort');
if (sortSelect) {
  sortSelect.addEventListener('change', applyFilterAndSort);
}

// Init
fetch(POSTS_URL)
  .then(r => r.json())
  .then(posts => {
    allPosts = posts;
    initFilters(posts);
    applyFilterAndSort();
  })
  .catch(() => {
    grid.innerHTML = `
      <div class="blog-empty">
        <h3>Unable to load posts</h3>
        <p>Please try again later.</p>
      </div>`;
    loadMoreWrap.hidden = true;
  });
