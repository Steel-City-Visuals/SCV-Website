// ── main single post page ──

const POSTS_URL        = 'blog/posts.json';
const GITHUB_POSTS_URL = `https://api.github.com/repos/Steel-City-Visuals/SCV-Website/contents/blog/posts.json?ref=main&t=${Date.now()}`;

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function getSlug() {
  return new URLSearchParams(window.location.search).get('slug');
}

function isPreview() {
  return new URLSearchParams(window.location.search).get('preview') === '1';
}

function readingTime(body) {
  const text  = body.replace(/<[^>]+>/g, ' ');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const mins  = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}

// Rewrite relative asset paths to absolute GitHub raw URLs for local preview
function rewriteForPreview(post) {
  const base  = 'https://raw.githubusercontent.com/Steel-City-Visuals/SCV-Website/main/';
  const toAbs = s => (s && !/^https?:\/\//.test(s)) ? base + s : s;
  return {
    ...post,
    image: toAbs(post.image),
    body:  post.body.replace(/(<img\b[^>]*\ssrc=")(?!https?:\/\/)([^"]*")/g, `$1${base}$2`),
  };
}

function render(post) {
  // Hero
  document.getElementById('post-hero-bg').style.backgroundImage = `url('${post.image}')`;
  document.getElementById('post-category').textContent  = post.category;
  document.getElementById('post-title').textContent     = post.title;
  document.getElementById('post-author-name').textContent  = post.author;
  document.getElementById('post-author-title').textContent = post.authorTitle || '';
  document.getElementById('post-date').textContent      = formatDate(post.date);
  document.getElementById('post-reading-time').textContent = readingTime(post.body);

  // Body
  document.getElementById('post-body').innerHTML = post.body;

  // Page title
  document.title = `${post.title}: Steel City Visuals`;

  // Share buttons
  const pageUrl     = window.location.href.split('?')[0] + `?slug=${post.slug}`;
  const shareTitle  = encodeURIComponent(post.title);
  const shareUrl    = encodeURIComponent(pageUrl);
  const twitterEl   = document.getElementById('share-twitter');
  const facebookEl  = document.getElementById('share-facebook');
  const copyEl      = document.getElementById('share-copy');
  if (twitterEl)  twitterEl.href  = `https://twitter.com/intent/tweet?text=${shareTitle}&url=${shareUrl}`;
  if (facebookEl) facebookEl.href = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
  if (copyEl) {
    copyEl.addEventListener('click', () => {
      navigator.clipboard.writeText(pageUrl).then(() => {
        copyEl.textContent = '✓ Copied!';
        copyEl.classList.add('copied');
        setTimeout(() => {
          copyEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Link`;
          copyEl.classList.remove('copied');
        }, 2000);
      });
    });
  }

  // SEO meta tags
  const metaDesc = post.metaDescription || post.excerpt || '';
  const ogImg    = post.ogImage || post.image || '';
  const setMeta  = (id, val) => { const el = document.getElementById(id); if (el) el.setAttribute('content', val); };
  setMeta('meta-description', metaDesc);
  setMeta('og-title',         post.title);
  setMeta('og-description',   metaDesc);
  setMeta('og-image',         ogImg);

  // Show content, hide loading state
  document.getElementById('post-loading').hidden = true;
  document.getElementById('post-content').hidden = false;
}

function showNotFound() {
  document.getElementById('post-loading').hidden = true;
  document.getElementById('post-not-found').hidden = false;
}

const slug    = getSlug();
const preview = isPreview();
// Locally (Live Server / localhost), images are only on GitHub — always rewrite URLs
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

if (!slug) {
  showNotFound();
} else if (preview) {
  // Check localStorage first — admin writes live form state here for unsaved previews
  let localPost = null;
  try {
    const stored = localStorage.getItem('scv_preview_draft');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.slug === slug) {
        localPost = parsed;
        localStorage.removeItem('scv_preview_draft');
      }
    }
  } catch {}

  if (localPost) {
    render(rewriteForPreview(localPost));
  } else {
    // Fall back to GitHub API for saved drafts
    fetch(GITHUB_POSTS_URL, { headers: { Accept: 'application/vnd.github+json' } })
      .then(r => r.json())
      .then(data => {
        const posts = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(data.content.replace(/\n/g, '')), c => c.charCodeAt(0))));
        const post  = posts.find(p => p.slug === slug);
        post ? render(rewriteForPreview(post)) : showNotFound();
      })
      .catch(showNotFound);
  }
} else {
  fetch(POSTS_URL)
    .then(r => r.json())
    .then(posts => {
      const post = posts.find(p => p.slug === slug && p.published !== false);
      if (!post) { showNotFound(); return; }
      render(isLocal ? rewriteForPreview(post) : post);
    })
    .catch(showNotFound);
}
