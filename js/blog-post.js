// ── Blog single post page ──

const POSTS_URL = 'blog/posts.json';

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function getSlug() {
  return new URLSearchParams(window.location.search).get('slug');
}

function render(post) {
  // Hero
  document.getElementById('post-hero-bg').style.backgroundImage = `url('${post.image}')`;
  document.getElementById('post-category').textContent  = post.category;
  document.getElementById('post-title').textContent     = post.title;
  document.getElementById('post-author-name').textContent  = post.author;
  document.getElementById('post-author-title').textContent = post.authorTitle || '';
  document.getElementById('post-date').textContent      = formatDate(post.date);

  // Body
  document.getElementById('post-body').innerHTML = post.body;

  // Page title
  document.title = `${post.title} — Steel City Visuals`;

  // Show content, hide loading state
  document.getElementById('post-loading').hidden = true;
  document.getElementById('post-content').hidden = false;
}

function showNotFound() {
  document.getElementById('post-loading').hidden = true;
  document.getElementById('post-not-found').hidden = false;
}

const slug = getSlug();

if (!slug) {
  showNotFound();
} else {
  fetch(POSTS_URL)
    .then(r => r.json())
    .then(posts => {
      const post = posts.find(p => p.slug === slug);
      post ? render(post) : showNotFound();
    })
    .catch(showNotFound);
}
