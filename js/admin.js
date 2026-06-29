// ── SCV Blog Admin ──

const REPO        = 'Steel-City-Visuals/SCV-Website';
const POSTS_PATH  = 'blog/posts.json';
const IMAGES_DIR  = 'assets/images/blog/';
const PW_HASH     = 'cf2d821917e9fc2be02fc00ad89275440f22a783d63c6dd7552ce5dd08e2deb0';
const TOKEN_KEY   = 'scv_admin_token';
const SESSION_KEY = 'scv_admin_authed';

const CATEGORIES  = ['Real Estate', 'Aerial', 'Wedding', 'Corporate', 'Behind the Scenes', 'Tips'];

// ── State ──
let posts      = [];
let fileSHA    = '';
let editingSlug = null;

// ── Utility ──

function $(id) { return document.getElementById(id); }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function formatDateDisplay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function toBase64(str) { return btoa(unescape(encodeURIComponent(str))); }
function fromBase64(str) { return decodeURIComponent(escape(atob(str))); }

let toastTimer;
function toast(msg, type = 'success') {
  const el = $('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ── Auth ──

async function hashPassword(pw) {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleLogin(e) {
  e.preventDefault();
  const pw    = $('login-password').value;
  const error = $('login-error');
  const hash  = await hashPassword(pw);

  if (hash !== PW_HASH) {
    error.textContent = 'Incorrect password. Please try again.';
    $('login-password').value = '';
    return;
  }

  sessionStorage.setItem(SESSION_KEY, '1');
  error.textContent = '';

  if (!localStorage.getItem(TOKEN_KEY)) {
    showScreen('screen-token');
  } else {
    await loadAndShowList();
  }
}

function handleLogout() {
  sessionStorage.removeItem(SESSION_KEY);
  showScreen('screen-login');
  $('login-password').value = '';
  $('login-error').textContent = '';
}

// ── Token Setup ──

function handleTokenSave() {
  const token = $('token-input').value.trim();
  if (!token) { toast('Please enter a token.', 'error'); return; }
  localStorage.setItem(TOKEN_KEY, token);
  loadAndShowList();
}

// ── GitHub API ──

function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }

async function ghRequest(method, path, body = null) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error ${res.status}`);
  }
  return res.json();
}

async function fetchPostsFromGitHub() {
  const data = await ghRequest('GET', POSTS_PATH);
  fileSHA = data.sha;
  posts   = JSON.parse(fromBase64(data.content.replace(/\n/g, '')));
  return posts;
}

async function savePostsToGitHub(commitMessage) {
  const content = toBase64(JSON.stringify(posts, null, 2));
  await ghRequest('PUT', POSTS_PATH, { message: commitMessage, content, sha: fileSHA });
  // Refresh SHA after commit
  const updated = await ghRequest('GET', POSTS_PATH);
  fileSHA = updated.sha;
}

async function uploadImage(file) {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(',')[1];
        const path   = IMAGES_DIR + file.name;
        // Check if file exists (to get SHA for update)
        let sha;
        try {
          const existing = await ghRequest('GET', path);
          sha = existing.sha;
        } catch {}

        const body = { message: `Upload blog image: ${file.name}`, content: base64 };
        if (sha) body.sha = sha;
        await ghRequest('PUT', path, body);
        resolve(path);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Post List ──

async function loadAndShowList() {
  $('list-loading').hidden  = false;
  $('list-content').hidden  = true;

  showScreen('screen-list');

  try {
    await fetchPostsFromGitHub();
    renderList();
    $('list-loading').hidden = true;
    $('list-content').hidden = false;
  } catch (err) {
    $('list-loading').textContent = `Error: ${err.message}`;
  }
}

function renderList() {
  const container = $('post-list');
  const sorted    = [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Update count
  $('post-count').textContent = `${posts.length} post${posts.length !== 1 ? 's' : ''}`;

  if (!sorted.length) {
    container.innerHTML = `
      <div class="post-list__empty">
        <p>No posts yet. Create your first one!</p>
        <button class="btn btn-primary" onclick="showPostForm(null)">+ New Post</button>
      </div>`;
    return;
  }

  container.innerHTML = sorted.map(post => `
    <div class="post-row">
      <div class="post-row__title">${post.title}</div>
      <div class="post-row__category">${post.category}</div>
      <div class="post-row__date">${formatDateDisplay(post.date)}</div>
      <div class="post-row__actions">
        <button class="btn btn-ghost btn-sm" onclick="showPostForm('${post.slug}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDelete('${post.slug}')">Delete</button>
      </div>
    </div>
  `).join('');
}

// ── Post Form ──

function showPostForm(slug) {
  editingSlug = slug;
  const post  = slug ? posts.find(p => p.slug === slug) : null;
  const title = slug ? 'Edit Post' : 'New Post';

  $('form-heading').textContent = title;

  // Populate fields
  $('f-title').value      = post?.title      || '';
  $('f-slug').value       = post?.slug       || '';
  $('f-author').value     = post?.author     || '';
  $('f-author-title').value = post?.authorTitle || '';
  $('f-date').value       = post?.date       || new Date().toISOString().slice(0, 10);
  $('f-excerpt').value    = post?.excerpt    || '';
  $('f-image-path').value = post?.image      || '';

  // Category
  const sel = $('f-category');
  sel.innerHTML = CATEGORIES.map(c =>
    `<option value="${c}" ${post?.category === c ? 'selected' : ''}>${c}</option>`
  ).join('');

  // Body editor
  $('editor-body').innerHTML = post?.body || '';

  // Image preview
  const preview = $('image-preview');
  if (post?.image) {
    preview.src = post.image;
    preview.classList.add('visible');
  } else {
    preview.classList.remove('visible');
    preview.src = '';
  }

  $('publish-status').textContent = '';
  $('publish-status').className   = 'publish-bar__status';

  showScreen('screen-form');
}

// Auto-generate slug from title + update preview
$('f-title').addEventListener('input', () => {
  if (!editingSlug) {
    const slug = slugify($('f-title').value);
    $('f-slug').value    = slug;
    $('slug-preview').textContent = slug;
  }
});

$('f-slug').addEventListener('input', () => {
  $('slug-preview').textContent = $('f-slug').value;
});

async function handlePublish() {
  const title       = $('f-title').value.trim();
  const slug        = $('f-slug').value.trim();
  const author      = $('f-author').value.trim();
  const authorTitle = $('f-author-title').value.trim();
  const date        = $('f-date').value;
  const category    = $('f-category').value;
  const excerpt     = $('f-excerpt').value.trim();
  const image       = $('f-image-path').value.trim();
  const body        = $('editor-body').innerHTML.trim();

  // Validation
  if (!title || !slug || !author || !date || !category || !excerpt || !body) {
    toast('Please fill in all required fields.', 'error');
    return;
  }

  const status  = $('publish-status');
  const saveBtn = $('publish-btn');
  status.textContent = 'Publishing…';
  status.className   = 'publish-bar__status saving';
  saveBtn.disabled   = true;

  try {
    // Re-fetch latest before writing to avoid conflicts
    await fetchPostsFromGitHub();

    const post = { slug, title, author, authorTitle, date, category, excerpt, image, body };

    if (editingSlug) {
      const idx = posts.findIndex(p => p.slug === editingSlug);
      if (idx !== -1) posts[idx] = post;
      else posts.push(post);
    } else {
      // Check slug uniqueness
      if (posts.some(p => p.slug === slug)) {
        toast('A post with this slug already exists.', 'error');
        status.textContent = '';
        saveBtn.disabled = false;
        return;
      }
      posts.unshift(post);
    }

    const action = editingSlug ? 'Update' : 'Add';
    await savePostsToGitHub(`${action} post: ${title}`);

    status.textContent = 'Published!';
    status.className   = 'publish-bar__status saved';
    toast(`Post "${title}" published successfully.`);

    setTimeout(() => {
      renderList();
      showScreen('screen-list');
    }, 1000);

  } catch (err) {
    status.textContent = `Error: ${err.message}`;
    status.className   = 'publish-bar__status error';
    toast(err.message, 'error');
  } finally {
    saveBtn.disabled = false;
  }
}

// ── Delete ──

let deleteTargetSlug = null;

function confirmDelete(slug) {
  const post = posts.find(p => p.slug === slug);
  if (!post) return;
  deleteTargetSlug = slug;
  $('confirm-title').textContent = `"${post.title}"`;
  $('modal-overlay').classList.add('active');
}

$('modal-cancel').addEventListener('click', () => {
  $('modal-overlay').classList.remove('active');
  deleteTargetSlug = null;
});

$('modal-confirm').addEventListener('click', async () => {
  $('modal-overlay').classList.remove('active');
  if (!deleteTargetSlug) return;

  const slug  = deleteTargetSlug;
  const post  = posts.find(p => p.slug === slug);
  deleteTargetSlug = null;

  try {
    await fetchPostsFromGitHub();
    posts = posts.filter(p => p.slug !== slug);
    await savePostsToGitHub(`Delete post: ${post?.title || slug}`);
    renderList();
    toast('Post deleted.');
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ── Image Upload ──

const imageInput = $('image-file-input');
const dropZone   = $('image-drop-zone');

function handleDragOver(e) { e.preventDefault(); dropZone.classList.add('dragover'); }
function handleDragLeave() { dropZone.classList.remove('dragover'); }
async function handleDrop(e) {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) await processImageUpload(file);
}

imageInput.addEventListener('change', async () => {
  const file = imageInput.files[0];
  if (file) await processImageUpload(file);
});

dropZone.addEventListener('dragover', handleDragOver);
dropZone.addEventListener('dragleave', handleDragLeave);
dropZone.addEventListener('drop', handleDrop);

async function processImageUpload(file) {
  const status  = $('image-upload-status');
  const preview = $('image-preview');

  status.textContent = 'Uploading…';
  status.className   = 'image-upload-status uploading';

  try {
    const path = await uploadImage(file);
    $('f-image-path').value = path;
    preview.src = path;
    preview.classList.add('visible');
    status.textContent = 'Image uploaded!';
    status.className   = 'image-upload-status success';
    toast('Image uploaded successfully.');
  } catch (err) {
    status.textContent = `Upload failed: ${err.message}`;
    status.className   = 'image-upload-status error';
    toast('Image upload failed.', 'error');
  }
}

// ── Rich Text Editor ──

function initEditor() {
  const editor = $('editor-body');

  document.querySelectorAll('.toolbar-btn[data-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      const cmd   = btn.dataset.cmd;
      const value = btn.dataset.value || null;

      if (cmd === 'createLink') {
        const url = prompt('Enter URL:');
        if (url) document.execCommand('createLink', false, url);
      } else {
        document.execCommand(cmd, false, value);
      }
      editor.focus();
    });
  });
}

// ── Wire Up ──

// Login
$('login-form').addEventListener('submit', handleLogin);
$('logout-btn').addEventListener('click', handleLogout);
$('logout-btn-form').addEventListener('click', handleLogout);

// Token
$('token-save-btn').addEventListener('click', handleTokenSave);
$('token-input').addEventListener('keydown', e => { if (e.key === 'Enter') handleTokenSave(); });

// List → New Post
$('new-post-btn').addEventListener('click', () => showPostForm(null));

// Form → Back
$('form-back-btn').addEventListener('click', () => showScreen('screen-list'));

// Publish
$('publish-btn').addEventListener('click', handlePublish);

// Init editor toolbar
initEditor();

// ── Boot ──
if (sessionStorage.getItem(SESSION_KEY)) {
  if (!localStorage.getItem(TOKEN_KEY)) {
    showScreen('screen-token');
  } else {
    loadAndShowList();
  }
} else {
  showScreen('screen-login');
}
