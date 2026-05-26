// ── SCV Admin Auth ──
// Shared by any page that supports ?mode=admin.
// Reads the session token, validates admin mode is active,
// and exposes helpers for the GitHub API commit workflow.

window.SCV_ADMIN = (() => {

  const SESSION_KEY = 'scv_admin_token';
  const REPO_OWNER  = 'Steel-City-Visuals';
  const REPO_NAME   = 'SCV-Website';
  const BRANCH      = 'main';

  // ── Session ───────────────────────────────────────────────────────────────

  function getToken() {
    return localStorage.getItem(SESSION_KEY);
  }

  function isAdminMode() {
    return new URLSearchParams(window.location.search).get('mode') === 'admin'
      && !!getToken();
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'admin/index.html';
  }

  // ── GitHub API ────────────────────────────────────────────────────────────

  function apiHeaders() {
    return {
      'Authorization': `Bearer ${getToken()}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };
  }

  // Fetch the current SHA of a file (needed to update it via the API)
  async function getFileSHA(path) {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`,
      { headers: apiHeaders() }
    );
    if (!res.ok) throw new Error(`Could not fetch SHA for ${path} (${res.status})`);
    const data = await res.json();
    return data.sha;
  }

  // Commit a JSON file to the repo
  // path: relative repo path, e.g. 'data/site.json'
  // content: JS object or string — will be JSON.stringify'd if object
  // message: commit message string
  async function commitJSON(path, content, message) {
    // getFileSHA returns 404 if the file doesn't exist yet — that's fine, we create it
    let sha;
    try { sha = await getFileSHA(path); } catch { sha = undefined; }

    const jsonString = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    const encoded = btoa(unescape(encodeURIComponent(jsonString)));

    const body = { message, content: encoded, branch: BRANCH };
    if (sha) body.sha = sha;

    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
      { method: 'PUT', headers: apiHeaders(), body: JSON.stringify(body) }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Commit failed (${res.status})`);
    }

    return res.json();
  }

  // Upload a binary file (image) to the repo
  // path: relative repo path, e.g. 'assets/images/portfolio/photo.jpg'
  // file: File object from an <input type="file">
  async function uploadFile(path, file, message) {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    const encoded = btoa(binary);

    // Check if file already exists (to get SHA for update vs create)
    let sha;
    try { sha = await getFileSHA(path); } catch { sha = undefined; }

    const body = { message, content: encoded, branch: BRANCH };
    if (sha) body.sha = sha;

    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
      { method: 'PUT', headers: apiHeaders(), body: JSON.stringify(body) }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Upload failed (${res.status})`);
    }

    return res.json();
  }

  return { getToken, isAdminMode, logout, commitJSON, uploadFile, REPO_OWNER, REPO_NAME, BRANCH };

})();
