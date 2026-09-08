// ── SCV Blog Admin ──

const REPO        = 'Steel-City-Visuals/SCV-Website';
const BRANCH      = 'main';
const POSTS_PATH  = 'blog/posts.json';
const IMAGES_DIR  = 'assets/images/blog/';
const CAMPAIGNS_PATH      = 'campaigns/campaigns.json';
const CAMPAIGN_IMAGES_DIR = 'assets/images/campaigns/';
const SITE_ORIGIN         = 'https://www.steelcityvisuals.com';

// Campaign slugs become top-level repo paths (/{slug}/index.html) — block anything
// that would collide with an existing site path.
const RESERVED_SLUGS = [
  'index', 'admin', 'accessibility', 'blog', 'blog-post', 'campaign', 'campaigns',
  'portfolio', 'privacy', 'css', 'js', 'assets', 'cname', 'readme', 'claude',
];
const RAW_BASE    = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`;

// Strip GitHub raw base URLs so stored HTML stays with clean relative paths
function stripRawBase(html) {
  return html.replace(new RegExp(RAW_BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
}
const PW_HASH     = 'Uxiu1XYRQMj7Oct5dcJKeyxXEh0mpJqYBAEb4U6C6fY=';
const TOKEN_KEY   = 'scv_admin_token';
const SESSION_KEY = 'scv_admin_authed';
const KEY_SESSION = 'scv_admin_key';

const CATEGORIES  = ['Real Estate', 'Aerial', 'Wedding', 'Corporate', 'Behind the Scenes', 'Tips'];

// ── State ──
let posts         = [];
let fileSHA       = '';
let editingSlug   = null;
let encryptionKey = null; // CryptoKey in memory only
let isDirty       = false;

let campaigns        = [];
let campaignsFileSHA = '';
let campaignsLoaded  = false;

// ── Utility ──

function $(id) { return document.getElementById(id); }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

function readingTime(body) {
  const text  = body.replace(/<[^>]+>/g, ' ');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const mins  = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
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

function toBase64(str) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
}
function fromBase64(str) {
  return new TextDecoder().decode(Uint8Array.from(atob(str), c => c.charCodeAt(0)));
}

let toastTimer;
function toast(msg, type = 'success') {
  const el = $('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ── Encryption ──

// Derive AES-GCM key from password using PBKDF2
async function deriveKey(password) {
  const enc         = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password),
    { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('scv-blog-admin-v1'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true, // extractable so we can persist in sessionStorage
    ['encrypt', 'decrypt']
  );
}

// Export CryptoKey → base64 string for sessionStorage
async function exportKey(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

// Import base64 string from sessionStorage → CryptoKey
async function importKey(b64) {
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

// Encrypt plaintext → base64 ciphertext (IV prepended)
async function encryptValue(plaintext, key) {
  const iv        = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)
  );
  const combined = new Uint8Array(12 + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), 12);
  return btoa(String.fromCharCode(...combined));
}

// Decrypt base64 ciphertext → plaintext
async function decryptValue(b64, key) {
  const combined  = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: combined.slice(0, 12) }, key, combined.slice(12)
  );
  return new TextDecoder().decode(decrypted);
}

// Retrieve and decrypt the stored token
async function getToken() {
  if (!encryptionKey) return '';
  const stored = localStorage.getItem(TOKEN_KEY);
  if (!stored) return '';
  try {
    return await decryptValue(stored, encryptionKey);
  } catch {
    return '';
  }
}

// Migrate a plaintext token to encrypted (handles existing saved tokens)
async function migrateTokenIfNeeded() {
  const stored = localStorage.getItem(TOKEN_KEY);
  if (!stored || !encryptionKey) return;
  const isPlaintext = stored.startsWith('ghp_') || stored.startsWith('github_pat_');
  if (isPlaintext) {
    const encrypted = await encryptValue(stored, encryptionKey);
    localStorage.setItem(TOKEN_KEY, encrypted);
  }
}

// ── Auth ──

// Derive PBKDF2 key and return {hash, key} — hash is base64 of raw key bytes
async function hashPassword(pw) {
  const key = await deriveKey(pw);
  const raw = await crypto.subtle.exportKey('raw', key);
  return { hash: btoa(String.fromCharCode(...new Uint8Array(raw))), key };
}

async function handleLogin(e) {
  e.preventDefault();
  const pw    = $('login-password').value;
  const error = $('login-error');
  const btn   = e.target.querySelector('[type="submit"]');
  btn.disabled    = true;
  btn.textContent = 'Signing in…';

  try {
    // Migration path: detect old plain SHA-256 hash (64 hex chars) vs new PBKDF2 hash
    const isLegacy = /^[0-9a-f]{64}$/.test(PW_HASH);

    if (isLegacy) {
      // Still accepts the old hash — logs the stronger replacement to console
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
      const sha = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      if (sha !== PW_HASH) {
        error.textContent = 'Incorrect password. Please try again.';
        $('login-password').value = '';
        return;
      }
      const { hash: newHash, key } = await hashPassword(pw);
      console.warn('🔐 Security upgrade ready — update PW_HASH in admin.js to:\n' + newHash);
      encryptionKey = key;
    } else {
      // New PBKDF2 hash — 100,000× harder to brute force than SHA-256
      const { hash, key } = await hashPassword(pw);
      if (hash !== PW_HASH) {
        error.textContent = 'Incorrect password. Please try again.';
        $('login-password').value = '';
        return;
      }
      encryptionKey = key;
    }

    const exportedKey = await exportKey(encryptionKey);
    sessionStorage.setItem(KEY_SESSION, exportedKey);
    sessionStorage.setItem(SESSION_KEY, '1');
    error.textContent = '';
    await migrateTokenIfNeeded();

    if (!localStorage.getItem(TOKEN_KEY)) {
      showScreen('screen-token');
    } else {
      await loadAndShowList();
    }
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Sign In';
  }
}

function handleLogout() {
  encryptionKey = null;
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(KEY_SESSION);
  showScreen('screen-login');
  $('login-password').value = '';
  $('login-error').textContent = '';
}

// ── Token Setup ──

async function handleTokenSave() {
  const token = $('token-input').value.trim();
  if (!token) { toast('Please enter a token.', 'error'); return; }
  if (!encryptionKey) { toast('Session expired. Please log in again.', 'error'); handleLogout(); return; }
  const encrypted = await encryptValue(token, encryptionKey);
  localStorage.setItem(TOKEN_KEY, encrypted);
  $('token-input').value = '';
  loadAndShowList();
}

// ── GitHub API ──

async function ghRequest(method, path, body = null) {
  const token = await getToken();
  const url   = method === 'GET'
    ? `https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}&t=${Date.now()}`
    : `https://api.github.com/repos/${REPO}/contents/${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
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
  await ghRequest('PUT', POSTS_PATH, { message: commitMessage, content, sha: fileSHA, branch: BRANCH });
  const updated = await ghRequest('GET', POSTS_PATH);
  fileSHA = updated.sha;
}

async function uploadImage(file, dir = IMAGES_DIR) {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(',')[1];
        const path   = dir + file.name;
        let sha;
        try {
          const existing = await ghRequest('GET', path);
          sha = existing.sha;
        } catch {}
        const body = { message: `Upload blog image: ${file.name}`, content: base64, branch: BRANCH };
        if (sha) body.sha = sha;
        await ghRequest('PUT', path, body);
        resolve(path);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Dashboard Tabs ──

function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(btn => {
    const active = btn.id === `admin-tab-${tab}`;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.admin-tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-panel-${tab}`);
  });
  $('new-post-btn').style.display = tab === 'posts' ? '' : 'none';

  if (tab === 'campaigns' && !campaignsLoaded) {
    campaignsLoaded = true;
    loadCampaignsTab();
  }
}

// ── Campaigns: GitHub API ──

async function fetchCampaignsFromGitHub() {
  try {
    const data = await ghRequest('GET', CAMPAIGNS_PATH);
    campaignsFileSHA = data.sha;
    campaigns = JSON.parse(fromBase64(data.content.replace(/\n/g, '')));
  } catch (err) {
    if (err.message.includes('Not Found') || err.message.includes('404')) {
      campaigns = [];
      campaignsFileSHA = '';
    } else {
      throw err;
    }
  }
  return campaigns;
}

async function saveCampaignsToGitHub(commitMessage) {
  const content = toBase64(JSON.stringify(campaigns, null, 2));
  const body = { message: commitMessage, content, branch: BRANCH };
  if (campaignsFileSHA) body.sha = campaignsFileSHA;
  await ghRequest('PUT', CAMPAIGNS_PATH, body);
  const updated = await ghRequest('GET', CAMPAIGNS_PATH);
  campaignsFileSHA = updated.sha;
}

// ── Campaign List ──

async function loadCampaignsTab() {
  $('campaign-list-loading').hidden = false;
  $('campaign-list').hidden         = true;
  try {
    await fetchCampaignsFromGitHub();
    renderCampaignList();
    $('campaign-list-loading').hidden = true;
    $('campaign-list').hidden         = false;
  } catch (err) {
    campaignsLoaded = false; // allow retry on next tab switch
    $('campaign-list-loading').textContent = `Error: ${err.message}`;
  }
}

function buildCampaignRow(campaign) {
  const statusClass = campaign.active ? 'status-badge--active' : 'status-badge--inactive';
  const statusLabel = campaign.active ? 'Active' : 'Inactive';
  return `
    <div class="post-row campaign-row">
      <div class="post-row__title">${campaign.name}</div>
      <div class="post-row__category">/${campaign.slug}</div>
      <div class="post-row__date"><span class="status-badge ${statusClass}">${statusLabel}</span></div>
      <div class="post-row__actions">
        <button class="btn btn-ghost btn-sm" onclick="copyCampaignUrl('${campaign.slug}')">Copy URL</button>
        <button class="btn btn-ghost btn-sm" onclick="showCampaignForm('${campaign.slug}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteCampaign('${campaign.slug}')">Delete</button>
      </div>
    </div>`;
}

function renderCampaignList() {
  const container = $('campaign-list');
  $('campaign-count').textContent = `${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''}`;

  if (!campaigns.length) {
    container.innerHTML = `
      <div class="post-list__empty">
        <p>No campaigns yet. Create your first one!</p>
        <button class="btn btn-primary" onclick="showCampaignForm(null)">+ New Campaign</button>
      </div>`;
    return;
  }

  container.innerHTML = campaigns.map(buildCampaignRow).join('');
}

$('new-campaign-btn').addEventListener('click', () => showCampaignForm(null));

function copyCampaignUrl(slug) {
  const url = `${SITE_ORIGIN}/${slug}`;
  navigator.clipboard.writeText(url)
    .then(() => toast('Campaign URL copied to clipboard.'))
    .catch(() => toast('Could not copy URL.', 'error'));
}

function confirmDeleteCampaign(slug) {
  const campaign = campaigns.find(c => c.slug === slug);
  if (!campaign) return;
  deleteTargetSlug = slug;
  deleteTargetType = 'campaign';
  $('confirm-title').textContent = `"${campaign.name}"`;
  $('modal-overlay').classList.add('active');
}

// ── Campaign Form ──

let editingCampaignSlug = null;

function showCampaignForm(slug, sourceCampaign = null) {
  editingCampaignSlug = slug;
  const campaign = slug ? campaigns.find(c => c.slug === slug) : sourceCampaign;

  $('campaign-form-heading').textContent = slug ? 'Edit Campaign' : 'New Campaign';
  $('cf-name').value        = campaign?.name        || '';
  $('cf-slug').value        = campaign?.slug        || '';
  $('cf-slug-preview').textContent = campaign?.slug || '';
  $('cf-description').value = campaign?.description || '';
  $('cf-image-path').value  = campaign?.image        || '';
  $('cf-image-alt').value   = campaign?.imageAlt     || '';
  $('cf-active').checked    = campaign ? campaign.active !== false : true;

  const preview = $('cf-image-preview');
  if (campaign?.image) {
    preview.src = campaign.image.startsWith('http') ? campaign.image : RAW_BASE + campaign.image;
    preview.classList.add('visible');
  } else {
    preview.classList.remove('visible');
    preview.src = '';
  }
  $('cf-image-upload-status').textContent = '';

  $('campaign-publish-status').textContent = '';
  $('campaign-publish-status').className   = 'publish-bar__status';

  // "Live" link — every saved campaign has a generated page, unlike blog drafts
  $('campaign-publish-live').style.display = slug ? '' : 'none';
  if (slug) $('view-campaign-link').href = `/${slug}`;

  isDirty = false;
  showScreen('screen-campaign-form');
}

$('cf-name').addEventListener('input', () => {
  if (!editingCampaignSlug) {
    const slug = slugify($('cf-name').value);
    $('cf-slug').value               = slug;
    $('cf-slug-preview').textContent = slug;
    clearFieldError($('cf-slug'));
  }
});

$('cf-slug').addEventListener('input', () => {
  $('cf-slug-preview').textContent = $('cf-slug').value;
});

['cf-name', 'cf-slug', 'cf-description', 'cf-image-path', 'cf-image-alt'].forEach(id => {
  $(id).addEventListener('input', e => { markDirty(); clearFieldError(e.target); });
});
$('cf-active').addEventListener('change', markDirty);

async function saveCampaign() {
  const name        = $('cf-name').value.trim();
  const slug        = $('cf-slug').value.trim();
  const description = $('cf-description').value.trim();
  const image        = $('cf-image-path').value.trim();
  const imageAlt      = $('cf-image-alt').value.trim();
  const active         = $('cf-active').checked;

  const requiredFields = [
    { value: name,        id: 'cf-name'        },
    { value: slug,        id: 'cf-slug'        },
    { value: description, id: 'cf-description' },
  ];

  const invalid = requiredFields.filter(f => !f.value);
  if (invalid.length) {
    invalid.forEach(f => $(f.id).classList.add('input-error'));
    $(invalid[0].id).closest('.form-field')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('Please fill in all required fields.', 'error');
    return;
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    $('cf-slug').classList.add('input-error');
    $('cf-slug').closest('.form-field')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('Slug can only contain lowercase letters, numbers, and hyphens.', 'error');
    return;
  }

  if (RESERVED_SLUGS.includes(slug)) {
    $('cf-slug').classList.add('input-error');
    $('cf-slug').closest('.form-field')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('That slug is reserved for the main site. Please choose another.', 'error');
    return;
  }

  const status  = $('campaign-publish-status');
  const saveBtn = $('campaign-save-btn');
  status.textContent = 'Saving…';
  status.className   = 'publish-bar__status saving';
  saveBtn.disabled    = true;

  const applyCampaign = (campaign) => {
    if (editingCampaignSlug) {
      const idx = campaigns.findIndex(c => c.slug === editingCampaignSlug);
      if (idx !== -1) campaigns[idx] = campaign; else campaigns.push(campaign);
    } else {
      campaigns.unshift(campaign);
    }
  };

  try {
    await fetchCampaignsFromGitHub();

    const campaign = { slug, name, description, image, imageAlt, active };

    if (!editingCampaignSlug && campaigns.some(c => c.slug === slug)) {
      toast('A campaign with this slug already exists.', 'error');
      status.textContent = '';
      saveBtn.disabled    = false;
      return;
    }

    applyCampaign(campaign);

    const action = editingCampaignSlug ? 'Update' : 'Add';
    try {
      await saveCampaignsToGitHub(`${action} campaign: ${name}`);
    } catch (saveErr) {
      // SHA conflict — re-fetch and retry once
      if (saveErr.message.includes('does not match') || saveErr.message.includes('409')) {
        await fetchCampaignsFromGitHub();
        applyCampaign(campaign);
        await saveCampaignsToGitHub(`${action} campaign: ${name}`);
      } else {
        throw saveErr;
      }
    }

    isDirty = false;
    status.textContent = 'Saved!';
    status.className   = 'publish-bar__status saved';
    toast(`"${name}" saved.`);

    await publishCampaignPage(campaign, editingCampaignSlug);

    setTimeout(() => { renderCampaignList(); showScreen('screen-list'); }, 1000);

  } catch (err) {
    status.textContent = 'Save failed.';
    status.className   = 'publish-bar__status error';
    toast(`Save failed: ${err.message}`, 'error');
  } finally {
    saveBtn.disabled = false;
  }
}

// ── Campaign Static Page Generation ──
//
// Each campaign gets a real committed file at /{slug}/index.html so the shared
// link returns a genuine HTTP 200 with baked <meta og:*> tags — link-preview
// crawlers (iMessage, Slack, Facebook, etc.) don't execute JS, so the tags have
// to be present in the raw HTML, not just set client-side. The visible page
// content is still rendered client-side by js/campaign.js from campaigns.json,
// so editing a campaign's copy only requires updating the JSON — this generated
// file only needs to be regenerated when the slug or shareable meta data changes,
// which is what happens on every save anyway.

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setMetaAttr(html, id, value) {
  const re = new RegExp(`(<meta[^>]*id="${id}"[^>]*content=")[^"]*(")`, 'i');
  return html.replace(re, `$1${value}$2`);
}

async function buildCampaignPageHTML(campaign) {
  const res = await fetch(`campaign.html?t=${Date.now()}`);
  if (!res.ok) throw new Error('Could not load the campaign page template.');
  let html = await res.text();

  // Rewrite relative asset/nav paths to root-absolute so the page still works
  // when committed one directory deep (e.g. /triplepackage/index.html)
  html = html.replace(
    /((?:src|href)=")(?!https?:\/\/|\/|#|mailto:|tel:|data:)([^"]+)"/g,
    '$1/$2"'
  );

  const name        = escapeHtml(campaign.name);
  const description = escapeHtml(campaign.description);
  const pageUrl      = `${SITE_ORIGIN}/${campaign.slug}`;
  const imageUrl      = campaign.image
    ? (campaign.image.startsWith('http') ? campaign.image : `${SITE_ORIGIN}/${campaign.image}`)
    : '';

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${name}: Steel City Visuals</title>`);
  html = setMetaAttr(html, 'meta-description', description);
  html = setMetaAttr(html, 'og-title',         name);
  html = setMetaAttr(html, 'og-description',   description);
  html = setMetaAttr(html, 'og-image',         imageUrl);
  html = setMetaAttr(html, 'og-url',           pageUrl);

  return html;
}

async function publishCampaignPage(campaign, oldSlug) {
  try {
    const html = await buildCampaignPageHTML(campaign);
    const path = `${campaign.slug}/index.html`;
    let sha;
    try {
      const existing = await ghRequest('GET', path);
      sha = existing.sha;
    } catch {}
    const body = { message: `Publish campaign page: ${campaign.name}`, content: toBase64(html), branch: BRANCH };
    if (sha) body.sha = sha;
    await ghRequest('PUT', path, body);

    // Slug changed on an existing campaign — remove the stale generated page
    if (oldSlug && oldSlug !== campaign.slug) {
      await deleteCampaignPage(oldSlug);
    }
  } catch (err) {
    toast(`Campaign saved, but the live page failed to publish: ${err.message}`, 'error');
  }
}

async function deleteCampaignPage(slug) {
  try {
    const path = `${slug}/index.html`;
    const file = await ghRequest('GET', path);
    await ghRequest('DELETE', path, {
      message: `Delete campaign page: ${slug}`,
      sha: file.sha,
      branch: BRANCH,
    });
  } catch (err) {
    console.warn('Could not delete campaign page:', err.message);
  }
}

$('campaign-save-btn').addEventListener('click', saveCampaign);
$('campaign-form-back-btn').addEventListener('click', () =>
  confirmDiscard(() => { renderCampaignList(); showScreen('screen-list'); })
);
$('logout-btn-campaign-form').addEventListener('click', handleLogout);

// ── Campaign Image Upload ──

const campaignImageInput = $('cf-image-file-input');
const campaignDropZone   = $('cf-image-drop-zone');

async function processCampaignImageUpload(file) {
  const status  = $('cf-image-upload-status');
  const preview = $('cf-image-preview');
  status.textContent = 'Uploading…';
  status.className   = 'image-upload-status uploading';
  const localPreviewUrl = URL.createObjectURL(file);
  try {
    const path = await uploadImage(file, CAMPAIGN_IMAGES_DIR);
    $('cf-image-path').value = path;
    preview.src = localPreviewUrl;
    preview.classList.add('visible');
    status.textContent = 'Image uploaded!';
    status.className   = 'image-upload-status success';
    toast('Image uploaded successfully.');
    markDirty();
  } catch (err) {
    status.textContent = `Upload failed: ${err.message}`;
    status.className   = 'image-upload-status error';
    toast('Image upload failed.', 'error');
  }
}

campaignImageInput.addEventListener('change', async () => {
  const file = campaignImageInput.files[0];
  if (file) await processCampaignImageUpload(file);
});

campaignDropZone.addEventListener('dragover', e => { e.preventDefault(); campaignDropZone.classList.add('dragover'); });
campaignDropZone.addEventListener('dragleave', () => campaignDropZone.classList.remove('dragover'));
campaignDropZone.addEventListener('drop', async e => {
  e.preventDefault();
  campaignDropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) await processCampaignImageUpload(file);
});

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

function buildPostRow(post) {
  return `
    <div class="post-row">
      <div class="post-row__title">${post.title}</div>
      <div class="post-row__category">${post.category}</div>
      <div class="post-row__date">${formatDateDisplay(post.date)}</div>
      <div class="post-row__reading-time">${post.body ? readingTime(post.body) : 'N/A'}</div>
      <div class="post-row__actions">
        <button class="btn btn-ghost btn-sm" onclick="showPostForm('${post.slug}')">Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="duplicatePost('${post.slug}')">Duplicate</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDelete('${post.slug}')">Delete</button>
      </div>
    </div>`;
}

function duplicatePost(slug) {
  const original = posts.find(p => p.slug === slug);
  if (!original) return;
  let newSlug = original.slug + '-copy';
  let n = 2;
  while (posts.some(p => p.slug === newSlug)) newSlug = original.slug + '-copy-' + n++;
  const copy = { ...original, slug: newSlug, title: 'Copy of ' + original.title, published: false };
  showPostForm(null, copy);
}

function renderList() {
  const container = $('post-list');
  const sorted    = [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));
  const published = sorted.filter(p => p.published !== false);
  const drafts    = sorted.filter(p => p.published === false);

  $('post-count').textContent = `${posts.length} post${posts.length !== 1 ? 's' : ''}`;

  if (!sorted.length) {
    container.innerHTML = `
      <div class="post-list__empty">
        <p>No posts yet. Create your first one!</p>
        <button class="btn btn-primary" onclick="showPostForm(null)">+ New Post</button>
      </div>`;
    return;
  }

  let html = '';

  if (published.length) {
    html += `<div class="post-list-section">
      <h3 class="post-list-section__title">Published <span class="post-list-section__count">${published.length}</span></h3>
      ${published.map(buildPostRow).join('')}
    </div>`;
  }

  if (drafts.length) {
    html += `<div class="post-list-section post-list-section--drafts">
      <h3 class="post-list-section__title">Drafts <span class="post-list-section__count">${drafts.length}</span></h3>
      ${drafts.map(buildPostRow).join('')}
    </div>`;
  }

  container.innerHTML = html;

  // Re-apply search filter if active
  const q = $('post-search')?.value.trim().toLowerCase();
  if (q) filterPostRows(q);
}

// ── Post Search ──

function filterPostRows(q) {
  document.querySelectorAll('.post-row').forEach(row => {
    const title = row.querySelector('.post-row__title').textContent.toLowerCase();
    row.style.display = title.includes(q) ? '' : 'none';
  });
  document.querySelectorAll('.post-list-section').forEach(section => {
    const anyVisible = [...section.querySelectorAll('.post-row')].some(r => r.style.display !== 'none');
    section.style.display = anyVisible ? '' : 'none';
  });
}

$('post-search').addEventListener('input', e => {
  filterPostRows(e.target.value.trim().toLowerCase());
});

// ── Post Form ──

function updateWordCount() {
  const text  = $('editor-body').innerText.replace(/\s+/g, ' ').trim();
  const words = text ? text.split(' ').filter(Boolean).length : 0;
  $('editor-word-count').textContent = `${words} word${words !== 1 ? 's' : ''}`;
}

function updateMetaDescCount() {
  const len = $('f-meta-desc').value.length;
  const el  = $('meta-desc-count');
  el.textContent = `${len}/160`;
  el.className   = 'char-count' + (len > 155 ? ' char-count--warn' : '');
}

function showPostForm(slug, sourcePost = null) {
  editingSlug = slug;
  const post  = slug ? posts.find(p => p.slug === slug) : sourcePost;

  $('form-heading').textContent = slug ? 'Edit Post' : (sourcePost ? 'Duplicate Post' : 'New Post');
  $('f-title').value            = post?.title       || '';
  $('f-slug').value             = post?.slug        || '';
  $('f-author').value           = post?.author      || '';
  $('f-author-title').value     = post?.authorTitle || '';
  $('f-date').value             = post?.date        || new Date().toISOString().slice(0, 10);
  $('f-excerpt').value          = post?.excerpt     || '';
  $('f-image-path').value       = post?.image       || '';
  $('f-image-alt').value        = post?.imageAlt    || '';
  $('f-meta-desc').value = post?.metaDescription || '';
  $('f-og-image').value  = post?.ogImage         || '';
  updateMetaDescCount();

  const sel = $('f-category');
  sel.innerHTML = CATEGORIES.map(c =>
    `<option value="${c}" ${post?.category === c ? 'selected' : ''}>${c}</option>`
  ).join('');

  $('editor-body').innerHTML = post?.body || '';
  updateWordCount();

  const preview = $('image-preview');
  if (post?.image) {
    // Use GitHub raw URL locally so the preview image loads even if not on disk
    preview.src = post.image.startsWith('http') ? post.image : RAW_BASE + post.image;
    preview.classList.add('visible');
  } else {
    preview.classList.remove('visible');
    preview.src = '';
  }

  $('publish-status').textContent = '';
  $('publish-status').className   = 'publish-bar__status';

  // Hide "Save Draft" and relabel "Publish" for already-published posts
  const isPublished = post ? post.published !== false : false;
  const arrowSvg = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  $('draft-btn').style.display    = isPublished ? 'none' : '';
  $('publish-btn').innerHTML      = isPublished ? `Update ${arrowSvg}` : `Publish ${arrowSvg}`;
  $('publish-live').style.display = isPublished ? '' : 'none';
  if (isPublished && post) $('view-post-link').href = `blog-post.html?slug=${post.slug}`;

  // Preview button — always visible; uses live form state via localStorage
  $('preview-btn').style.display = '';

  isDirty = false;
  showScreen('screen-form');
}

$('f-title').addEventListener('input', () => {
  if (!editingSlug) {
    const slug = slugify($('f-title').value);
    $('f-slug').value             = slug;
    $('slug-preview').textContent = slug;
    clearFieldError($('f-slug'));
  }
});

$('f-slug').addEventListener('input', () => {
  $('slug-preview').textContent = $('f-slug').value;
});

async function savePost(published) {
  const title       = $('f-title').value.trim();
  const slug        = $('f-slug').value.trim();
  const author      = $('f-author').value.trim();
  const authorTitle = $('f-author-title').value.trim();
  const date        = $('f-date').value;
  const category    = $('f-category').value;
  const excerpt     = $('f-excerpt').value.trim();
  const image       = $('f-image-path').value.trim();
  const imageAlt        = $('f-image-alt').value.trim();
  const metaDescription = $('f-meta-desc').value.trim();
  const ogImage         = $('f-og-image').value.trim();
  const body        = stripRawBase($('editor-body').innerHTML.trim());

  const requiredFields = [
    { value: title,   id: 'f-title'   },
    { value: slug,    id: 'f-slug'    },
    { value: author,  id: 'f-author'  },
    { value: date,    id: 'f-date'    },
    { value: excerpt, id: 'f-excerpt' },
    { value: body,    id: 'editor-body', errorTarget: 'editor-wrap' },
  ];

  const invalid = requiredFields.filter(f => !f.value);
  if (invalid.length) {
    invalid.forEach(f => {
      const target = f.errorTarget ? document.querySelector(`.${f.errorTarget}`) : $(f.id);
      target.classList.add('input-error');
    });
    $(invalid[0].errorTarget ? 'editor-body' : invalid[0].id).closest('.form-field, .editor-wrap')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('Please fill in all required fields.', 'error');
    return;
  }

  const status    = $('publish-status');
  const publishBtn = $('publish-btn');
  const draftBtn   = $('draft-btn');
  status.textContent = published ? 'Publishing…' : 'Saving draft…';
  status.className   = 'publish-bar__status saving';
  publishBtn.disabled = true;
  draftBtn.disabled   = true;

  const applyPost = (post) => {
    if (editingSlug) {
      const idx = posts.findIndex(p => p.slug === editingSlug);
      if (idx !== -1) posts[idx] = post; else posts.push(post);
    } else {
      posts.unshift(post);
    }
  };

  try {
    await fetchPostsFromGitHub();

    const post = { slug, title, author, authorTitle, date, category, excerpt, image, imageAlt, metaDescription, ogImage, body, published };

    if (!editingSlug && posts.some(p => p.slug === slug)) {
      toast('A post with this slug already exists.', 'error');
      status.textContent = '';
      publishBtn.disabled = false;
      draftBtn.disabled   = false;
      return;
    }

    applyPost(post);

    const action = editingSlug ? 'Update' : (published ? 'Add' : 'Draft');
    try {
      await savePostsToGitHub(`${action} post: ${title}`);
    } catch (saveErr) {
      // SHA conflict — re-fetch and retry once
      if (saveErr.message.includes('does not match') || saveErr.message.includes('409')) {
        await fetchPostsFromGitHub();
        applyPost(post);
        await savePostsToGitHub(`${action} post: ${title}`);
      } else {
        throw saveErr;
      }
    }

    isDirty = false;
    status.textContent = published ? 'Published!' : 'Draft saved!';
    status.className   = 'publish-bar__status saved';
    toast(published ? `"${title}" published.` : `"${title}" saved as draft.`);

    setTimeout(() => { renderList(); showScreen('screen-list'); }, 1000);

  } catch (err) {
    status.textContent = 'Save failed.';
    status.className   = 'publish-bar__status error';
    toast(`Save failed: ${err.message}`, 'error');
  } finally {
    publishBtn.disabled = false;
    draftBtn.disabled   = false;
  }
}

function handlePublish() { return savePost(true);  }
function handleDraft()   { return savePost(false); }

// ── Delete ──

let deleteTargetSlug = null;
let deleteTargetType = 'post'; // 'post' | 'campaign'

function confirmDelete(slug) {
  const post = posts.find(p => p.slug === slug);
  if (!post) return;
  deleteTargetSlug = slug;
  deleteTargetType = 'post';
  $('confirm-title').textContent = `"${post.title}"`;
  $('modal-overlay').classList.add('active');
}

$('modal-cancel').addEventListener('click', () => {
  $('modal-overlay').classList.remove('active');
  deleteTargetSlug = null;
});

async function deleteImageFromGitHub(imagePath) {
  try {
    const file = await ghRequest('GET', imagePath);
    await ghRequest('DELETE', imagePath, {
      message: `Delete blog image: ${imagePath.split('/').pop()}`,
      sha: file.sha,
      branch: BRANCH,
    });
  } catch (err) {
    console.warn('Could not delete image:', err.message);
  }
}

$('modal-confirm').addEventListener('click', async () => {
  $('modal-overlay').classList.remove('active');
  if (!deleteTargetSlug) return;
  const slug = deleteTargetSlug;
  const type = deleteTargetType;
  deleteTargetSlug = null;

  if (type === 'campaign') {
    const campaign = campaigns.find(c => c.slug === slug);
    try {
      await fetchCampaignsFromGitHub();
      const imagePath = campaign?.image;
      campaigns = campaigns.filter(c => c.slug !== slug);
      await saveCampaignsToGitHub(`Delete campaign: ${campaign?.name || slug}`);

      // Delete image only if it lives in the campaign images folder and no other campaign references it
      if (imagePath && imagePath.startsWith(CAMPAIGN_IMAGES_DIR)) {
        const sharedByOther = campaigns.some(c => c.image === imagePath);
        if (!sharedByOther) {
          await deleteImageFromGitHub(imagePath);
        }
      }

      await deleteCampaignPage(slug);

      renderCampaignList();
      toast('Campaign deleted.');
    } catch (err) {
      toast(err.message, 'error');
    }
    return;
  }

  const post = posts.find(p => p.slug === slug);
  try {
    await fetchPostsFromGitHub();
    const imagePath = post?.image;
    posts = posts.filter(p => p.slug !== slug);
    await savePostsToGitHub(`Delete post: ${post?.title || slug}`);

    // Delete image only if it lives in the blog images folder and no other post references it
    if (imagePath && imagePath.startsWith(IMAGES_DIR)) {
      const sharedByOtherPost = posts.some(p => p.image === imagePath);
      if (!sharedByOtherPost) {
        await deleteImageFromGitHub(imagePath);
      }
    }

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
  const localPreviewUrl = URL.createObjectURL(file);
  try {
    const path = await uploadImage(file);
    $('f-image-path').value = path;
    preview.src = localPreviewUrl;
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

// ── Inline Image Modal ──

let imgSavedRange = null;

function openImgModal() {
  imgSavedRange = null;
  const sel = window.getSelection();
  if (sel && sel.rangeCount) imgSavedRange = sel.getRangeAt(0).cloneRange();
  $('img-modal-path').value   = '';
  $('img-modal-alt').value    = '';
  $('img-modal-status').textContent = '';
  $('img-modal-status').className   = 'img-modal-drop__status';
  $('img-modal-overlay').classList.add('active');
  setTimeout(() => $('img-modal-alt').focus(), 50);
}

function closeImgModal() {
  $('img-modal-overlay').classList.remove('active');
  imgSavedRange = null;
}

function confirmInsertImg() {
  const path  = $('img-modal-path').value.trim();
  const alt   = $('img-modal-alt').value.trim();
  const align = document.querySelector('input[name="img-align"]:checked')?.value || 'center';
  closeImgModal();
  if (!path) return;

  const styleMap = {
    left:   'float:left; margin:8px 20px 8px 0; max-width:45%; height:auto;',
    right:  'float:right; margin:8px 0 8px 20px; max-width:45%; height:auto;',
    center: 'display:block; margin:16px auto; max-width:100%; height:auto;',
    full:   'display:block; width:100%; height:auto; margin:16px 0;',
  };
  const style = styleMap[align];

  // Wrap floated images in a clearfix div so they don't bleed into next sections
  const html = (align === 'left' || align === 'right')
    ? `<div style="overflow:hidden; margin:16px 0;"><img src="${path}" alt="${alt}" style="${style}" /></div>`
    : `<img src="${path}" alt="${alt}" style="${style}" />`;

  const editor = $('editor-body');
  editor.focus();
  if (imgSavedRange) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(imgSavedRange);
  }
  document.execCommand('insertHTML', false, html);
}

$('img-modal-cancel').addEventListener('click', closeImgModal);
$('img-modal-confirm').addEventListener('click', confirmInsertImg);
$('img-modal-overlay').addEventListener('click', e => { if (e.target === $('img-modal-overlay')) closeImgModal(); });

// File upload inside inline image modal
const imgModalFile = $('img-modal-file');
const imgModalDrop = $('img-modal-drop');

// NOTE: No click listener needed — the file input covers the entire drop zone via CSS
//       (position: absolute; inset: 0; opacity: 0) and handles clicks natively.
imgModalDrop.addEventListener('dragover', e => { e.preventDefault(); imgModalDrop.classList.add('dragover'); });
imgModalDrop.addEventListener('dragleave', () => imgModalDrop.classList.remove('dragover'));
imgModalDrop.addEventListener('drop', async e => {
  e.preventDefault();
  imgModalDrop.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) await handleImgModalUpload(file);
});
imgModalFile.addEventListener('change', async () => {
  if (imgModalFile.files[0]) await handleImgModalUpload(imgModalFile.files[0]);
});

async function handleImgModalUpload(file) {
  const status = $('img-modal-status');
  status.textContent = 'Uploading…';
  status.className   = 'img-modal-drop__status uploading';
  try {
    const path = await uploadImage(file);
    $('img-modal-path').value = path;
    status.textContent = 'Uploaded!';
    status.className   = 'img-modal-drop__status success';
    if (!$('img-modal-alt').value) $('img-modal-alt').focus();
  } catch (err) {
    status.textContent = `Upload failed: ${err.message}`;
    status.className   = 'img-modal-drop__status error';
  }
}

// ── Rich Text Editor ──

let savedLinkRange = null;

function openLinkModal() {
  const sel      = window.getSelection();
  const hasRange = sel && sel.rangeCount && !sel.isCollapsed;
  savedLinkRange = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;

  const selectedText = hasRange ? sel.toString() : '';

  // Pre-fill if selection is already a link
  let existingUrl = '';
  if (savedLinkRange) {
    const container = savedLinkRange.commonAncestorContainer;
    const anchor    = (container.nodeType === 1 ? container : container.parentElement).closest('a');
    if (anchor) existingUrl = anchor.href;
  }

  $('link-text-input').value = selectedText;
  $('link-url-input').value  = existingUrl;
  $('link-new-tab').checked  = true;

  // Update modal title based on context
  $('link-modal-title').textContent = selectedText ? 'Link Selected Text' : 'Insert Link';
  $('link-text-input').placeholder  = selectedText ? selectedText : 'Text to display…';

  $('link-modal-overlay').classList.add('active');
  setTimeout(() => (existingUrl ? $('link-url-input') : $('link-text-input')).focus(), 50);
}

function closeLinkModal() {
  $('link-modal-overlay').classList.remove('active');
  $('link-text-input').value = '';
  $('link-url-input').value  = '';
  savedLinkRange             = null;
}

function confirmInsertLink() {
  const url         = $('link-url-input').value.trim();
  const text        = $('link-text-input').value.trim();
  const newTab      = $('link-new-tab').checked;
  const target      = newTab ? ' target="_blank" rel="noopener noreferrer"' : '';
  const rangeToUse  = savedLinkRange; // capture before closeLinkModal clears it
  const rangeText   = rangeToUse ? rangeToUse.toString() : '';

  closeLinkModal();
  if (!url) return;
  if (/^javascript:/i.test(url)) { toast('That URL is not allowed.', 'error'); return; }

  const editor      = $('editor-body');
  const displayText = text || rangeText || url;
  const html        = `<a href="${url}"${target}>${displayText}</a>`;

  // Focus editor first, then restore range, then insert — order matters
  editor.focus();
  if (rangeToUse) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(rangeToUse);
  }
  document.execCommand('insertHTML', false, html);
}

$('link-modal-cancel').addEventListener('click', closeLinkModal);
$('link-modal-confirm').addEventListener('click', confirmInsertLink);
$('link-url-input').addEventListener('keydown', e => { if (e.key === 'Enter') confirmInsertLink(); });
$('link-modal-overlay').addEventListener('click', e => { if (e.target === $('link-modal-overlay')) closeLinkModal(); });

function initEditor() {
  const editor = $('editor-body');

  document.querySelectorAll('.toolbar-btn[data-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      const cmd   = btn.dataset.cmd;
      const value = btn.dataset.value || null;
      if (cmd === 'createLink') {
        openLinkModal();
      } else if (cmd === 'insertImage') {
        openImgModal();
      } else {
        document.execCommand(cmd, false, value);
        editor.focus();
      }
    });
  });

  // Keyboard shortcuts: Cmd/Ctrl+B, +I, +K
  editor.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (e.key === 'b') { e.preventDefault(); document.execCommand('bold',   false, null); }
    if (e.key === 'i') { e.preventDefault(); document.execCommand('italic', false, null); }
    if (e.key === 'k') { e.preventDefault(); openLinkModal(); }
  });

  // When an image fails locally, try the GitHub raw URL as a fallback.
  // If that also fails, mark as broken.
  editor.addEventListener('error', e => {
    if (e.target.tagName !== 'IMG') return;
    const img = e.target;
    const src = img.getAttribute('src') || '';
    if (!img.dataset.rawTried && src && !src.startsWith('http') && !src.startsWith('//')) {
      img.dataset.rawTried = '1';
      img.src = RAW_BASE + src;
    } else {
      img.classList.add('img-broken');
    }
  }, true);

  // Shift+click links in the editor to open them in a new tab
  editor.addEventListener('click', e => {
    const anchor = e.target.closest('a');
    if (anchor && e.shiftKey) {
      e.preventDefault();
      window.open(anchor.href, '_blank', 'noopener,noreferrer');
    }
  });

  // Show a tooltip hint on link hover so user knows about shift+click
  editor.addEventListener('mouseover', e => {
    const anchor = e.target.closest('a');
    if (anchor && !anchor.title) {
      anchor.title = 'Shift+click to open link';
    }
  });

  // Change cursor to pointer when Shift is held over a link
  let hoveredAnchor = null;

  editor.addEventListener('mousemove', e => {
    const anchor = e.target.closest('a') || null;
    if (anchor !== hoveredAnchor) {
      if (hoveredAnchor) hoveredAnchor.style.cursor = '';
      hoveredAnchor = anchor;
    }
    if (hoveredAnchor) hoveredAnchor.style.cursor = e.shiftKey ? 'pointer' : '';
  });

  editor.addEventListener('mouseout', e => {
    if (hoveredAnchor) { hoveredAnchor.style.cursor = ''; hoveredAnchor = null; }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Shift' && hoveredAnchor) hoveredAnchor.style.cursor = 'pointer';
  });
  document.addEventListener('keyup', e => {
    if (e.key === 'Shift' && hoveredAnchor) hoveredAnchor.style.cursor = '';
  });
}

// ── Dirty Tracking & Error Clearing ──

function markDirty() { isDirty = true; }

function clearFieldError(el) { el.classList.remove('input-error'); }

['f-title','f-slug','f-author','f-author-title','f-date','f-excerpt','f-image-path'].forEach(id => {
  $(id).addEventListener('input', e => { markDirty(); clearFieldError(e.target); });
});
$('f-category').addEventListener('change', markDirty);
$('editor-body').addEventListener('input', () => {
  markDirty();
  updateWordCount();
  document.querySelector('.editor-wrap')?.classList.remove('input-error');
});

$('f-meta-desc').addEventListener('input', () => { markDirty(); updateMetaDescCount(); });
$('f-og-image').addEventListener('input', markDirty);

// ── Discard Modal ──

let discardCallback = null;

function confirmDiscard(onConfirm) {
  if (!isDirty) { onConfirm(); return; }
  discardCallback = onConfirm;
  $('discard-modal-overlay').classList.add('active');
}

$('discard-cancel').addEventListener('click', () => {
  $('discard-modal-overlay').classList.remove('active');
  discardCallback = null;
});

$('discard-confirm').addEventListener('click', () => {
  $('discard-modal-overlay').classList.remove('active');
  isDirty = false;
  if (discardCallback) { discardCallback(); discardCallback = null; }
});

// Warn on tab/window close
window.addEventListener('beforeunload', e => {
  if (isDirty) { e.preventDefault(); e.returnValue = ''; }
});

// ── Wire Up ──

// ── Live Preview ──
// Serialize current form state into localStorage so blog-post.html can read it
// without requiring the post to be saved first.
$('preview-btn').addEventListener('click', e => {
  e.preventDefault();
  const slug = $('f-slug').value.trim() || editingSlug;
  if (!slug) { toast('Add a URL slug before previewing.', 'error'); return; }

  const previewData = {
    slug,
    title:       $('f-title').value.trim()       || '(Untitled)',
    author:      $('f-author').value.trim()       || 'Author',
    authorTitle: $('f-author-title').value.trim(),
    date:        $('f-date').value                || new Date().toISOString().slice(0, 10),
    category:    $('f-category').value,
    excerpt:     $('f-excerpt').value.trim(),
    image:       $('f-image-path').value.trim(),
    imageAlt:    $('f-image-alt').value.trim(),
    body:        stripRawBase($('editor-body').innerHTML.trim()),
    published:   false,
  };
  localStorage.setItem('scv_preview_draft', JSON.stringify(previewData));
  window.open(`blog-post.html?slug=${slug}&preview=1`, '_blank', 'noopener,noreferrer');
});

$('campaign-preview-btn').addEventListener('click', e => {
  e.preventDefault();
  const slug = $('cf-slug').value.trim() || editingCampaignSlug;
  if (!slug) { toast('Add a URL slug before previewing.', 'error'); return; }

  const previewData = {
    slug,
    name:        $('cf-name').value.trim()        || '(Untitled Campaign)',
    description: $('cf-description').value.trim(),
    image:       $('cf-image-path').value.trim(),
    imageAlt:    $('cf-image-alt').value.trim(),
    active:      $('cf-active').checked,
  };
  localStorage.setItem('scv_campaign_preview_draft', JSON.stringify(previewData));
  window.open(`campaign.html?slug=${slug}&preview=1`, '_blank', 'noopener,noreferrer');
});

$('login-form').addEventListener('submit', handleLogin);
$('logout-btn').addEventListener('click', handleLogout);
$('logout-btn-form').addEventListener('click', handleLogout);
$('token-save-btn').addEventListener('click', handleTokenSave);
$('token-input').addEventListener('keydown', e => { if (e.key === 'Enter') handleTokenSave(); });
$('new-post-btn').addEventListener('click', () => showPostForm(null));
$('form-back-btn').addEventListener('click', () => confirmDiscard(() => { renderList(); showScreen('screen-list'); }));
$('publish-btn').addEventListener('click', handlePublish);
$('draft-btn').addEventListener('click', handleDraft);

initEditor();

// ── Boot ──
// Restore encryption key from sessionStorage if session is still active
(async () => {
  const sessionActive = sessionStorage.getItem(SESSION_KEY);
  const savedKey      = sessionStorage.getItem(KEY_SESSION);

  if (sessionActive && savedKey) {
    try {
      encryptionKey = await importKey(savedKey);
      await migrateTokenIfNeeded();
      if (!localStorage.getItem(TOKEN_KEY)) {
        showScreen('screen-token');
      } else {
        await loadAndShowList();
      }
    } catch {
      // Key restore failed — force re-login
      handleLogout();
      showScreen('screen-login');
    }
  } else {
    showScreen('screen-login');
  }
})();
