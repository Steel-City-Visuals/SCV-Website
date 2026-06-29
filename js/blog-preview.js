// ── Homepage blog preview — 3 most recent posts ──

const POSTS_URL = 'blog/posts.json';

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
      <h3 class="blog-card__title">${post.title}</h3>
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

const grid    = document.getElementById('blog-preview-grid');
const section = document.getElementById('blog-preview-section');

if (grid) {
  fetch(POSTS_URL)
    .then(r => r.json())
    .then(posts => {
      if (!posts.length) { section.hidden = true; return; }

      const latest = [...posts]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 3);

      latest.forEach(post => grid.appendChild(buildCard(post)));
    })
    .catch(() => { if (section) section.hidden = true; });
}
