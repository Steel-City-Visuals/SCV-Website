// ── SCV Portfolio Admin — Phase 5 ──
// Features: inline text editing, custom delete modal, category manager, photo upload.

(function () {
  if (typeof SCV_ADMIN === 'undefined' || !SCV_ADMIN.isAdminMode()) return;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function setByPath(obj, path, value) {
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
    cur[parts[parts.length - 1]] = value;
  }

  function slugify(str) {
    return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  // ── State ─────────────────────────────────────────────────────────────────

  const editables       = new Map();   // hero text fields
  let   localCategories = [];          // working copy — updated by category manager

  function countPending() {
    let n = 0;
    editables.forEach(({ el, original }) => { if (el.textContent !== original) n++; });
    return n;
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  const style = document.createElement('style');
  style.textContent = `
    /* ── Admin bar ── */
    #port-admin-bar {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
      background: #111; border-top: 2px solid #c9a84c;
      display: flex; align-items: center; gap: 10px; padding: 0 20px; height: 56px;
      font-family: 'Inter', sans-serif; font-size: 13px; color: #f0f0f0;
      box-shadow: 0 -4px 24px rgba(0,0,0,0.5);
    }
    .port-badge  { display:flex; align-items:center; gap:6px; font-weight:700; color:#c9a84c; white-space:nowrap; }
    .port-dot    { width:8px; height:8px; background:#c9a84c; border-radius:50%; animation:port-pulse 2s ease-in-out infinite; }
    @keyframes port-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
    .port-divider { width:1px; height:24px; background:#2a2a2a; flex-shrink:0; }
    .port-spacer  { flex:1; }
    .port-changes { color:#888; font-size:12px; white-space:nowrap; }
    .port-changes.has-changes { color:#c9a84c; font-weight:600; }

    #port-admin-bar button {
      border:none; border-radius:6px; padding:7px 13px;
      font-family:'Inter',sans-serif; font-size:12px; font-weight:600;
      cursor:pointer; white-space:nowrap; transition:background 0.15s, opacity 0.15s;
    }
    #port-admin-bar button:disabled { opacity:0.35; cursor:not-allowed; }

    #btn-port-discard { background:transparent; color:#888; border:1px solid #2a2a2a !important; }
    #btn-port-discard:hover:not(:disabled) { color:#f0f0f0; border-color:#555 !important; }
    #btn-port-publish { background:#c9a84c; color:#000; }
    #btn-port-publish:hover:not(:disabled) { background:#a8873a; }
    #btn-port-add     { background:#c9a84c; color:#000; }
    #btn-port-add:hover { background:#a8873a; }
    #btn-port-cats    { background:#1e1e1e; color:#c9a84c; border:1px solid #333 !important; }
    #btn-port-cats:hover { background:#252525; }
    #btn-port-signout { background:transparent; color:#555; font-size:11px; }
    #btn-port-signout:hover { color:#e05a5a; }
    body { padding-bottom: 56px !important; }

    /* ── Toast ── */
    #port-toast {
      position:fixed; bottom:68px; right:20px; z-index:99998;
      padding:12px 16px; border-radius:8px;
      font-family:'Inter',sans-serif; font-size:13px; font-weight:500;
      display:none; align-items:center; gap:8px;
      max-width:400px; box-shadow:0 4px 16px rgba(0,0,0,0.4);
    }
    #port-toast.success { display:flex; background:rgba(76,175,130,0.15); border:1px solid rgba(76,175,130,0.35); color:#4caf82; }
    #port-toast.error   { display:flex; background:rgba(224,90,90,0.15);  border:1px solid rgba(224,90,90,0.3);  color:#e05a5a; }

    /* ── Editable text ── */
    [data-editable]:hover  { outline:1px dashed rgba(201,168,76,0.5); outline-offset:2px; cursor:text; }
    [data-editable]:focus  { outline:2px solid #c9a84c; outline-offset:2px; border-radius:2px; }
    [data-editable].is-changed { outline:1px solid rgba(201,168,76,0.4); background:rgba(201,168,76,0.05); }

    /* ── Delete button on cards ── */
    .portfolio-item { position: relative; }
    .port-del-btn {
      position:absolute; top:8px; right:8px; z-index:20;
      width:30px; height:30px; border-radius:50%;
      background:rgba(20,20,20,0.85); color:#e05a5a;
      border:1px solid rgba(224,90,90,0.4) !important;
      font-size:18px; line-height:1; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      opacity:0; transition:opacity 0.15s, background 0.15s;
      font-family:'Inter',sans-serif;
    }
    .portfolio-item:hover .port-del-btn { opacity:1; }
    .port-del-btn:hover { background:rgba(224,90,90,0.9) !important; color:#fff; }
    .port-del-btn:disabled { cursor:wait; }

    /* ── Shared modal backdrop ── */
    .port-modal-bg {
      position:fixed; inset:0; z-index:10000;
      background:rgba(0,0,0,0.78);
      display:none; align-items:center; justify-content:center; padding:20px;
    }
    .port-modal-bg.open { display:flex; }
    .port-modal-panel {
      background:#141414; border:1px solid #2a2a2a; border-radius:14px;
      padding:28px; width:100%; max-width:480px; max-height:90vh; overflow-y:auto;
      font-family:'Inter',sans-serif; color:#f0f0f0;
    }
    .pm-h { font-size:18px; font-weight:700; margin-bottom:8px; }
    .pm-sub { font-size:13px; color:#888; margin-bottom:20px; line-height:1.5; }
    .pm-field { margin-bottom:14px; }
    .pm-lbl {
      display:block; font-size:11px; font-weight:700;
      color:#888; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px;
    }
    .pm-lbl-note { color:#555; font-weight:400; text-transform:none; letter-spacing:0; }
    .pm-in, .pm-sel {
      width:100%; background:#0a0a0a; border:1px solid #2a2a2a; border-radius:8px;
      padding:10px 12px; color:#f0f0f0; font-family:'Inter',sans-serif; font-size:14px;
      outline:none; transition:border-color 0.15s; box-sizing:border-box;
    }
    .pm-in:focus, .pm-sel:focus { border-color:#c9a84c; }
    .pm-sel option { background:#141414; }
    .pm-actions { display:flex; gap:10px; justify-content:flex-end; margin-top:22px; }
    .pm-actions button {
      padding:10px 20px; border-radius:8px;
      font-family:'Inter',sans-serif; font-size:14px; font-weight:700;
      cursor:pointer; border:none; transition:background 0.15s, opacity 0.15s;
    }
    .pm-btn-cancel { background:transparent; color:#888; border:1px solid #2a2a2a !important; }
    .pm-btn-cancel:hover { color:#f0f0f0; }
    .pm-btn-danger { background:#e05a5a; color:#fff; }
    .pm-btn-danger:hover:not(:disabled) { background:#c94444; }
    .pm-btn-primary { background:#c9a84c; color:#000; }
    .pm-btn-primary:hover:not(:disabled) { background:#a8873a; }
    .pm-btn-primary:disabled, .pm-btn-danger:disabled { opacity:0.4; cursor:not-allowed; }

    /* ── Upload modal — image drop zone ── */
    #pm-zone {
      width:100%; aspect-ratio:16/9;
      background:#0a0a0a; border:2px dashed #2a2a2a; border-radius:10px;
      display:flex; align-items:center; justify-content:center;
      cursor:pointer; margin-bottom:18px; overflow:hidden;
      transition:border-color 0.15s; position:relative;
    }
    #pm-zone:hover { border-color:#c9a84c; }
    #pm-zone.loaded { border:2px solid #333; }
    #pm-preview { width:100%; height:100%; object-fit:cover; display:none; }
    #pm-zone.loaded #pm-preview { display:block; }
    #pm-placeholder {
      display:flex; flex-direction:column; align-items:center; gap:10px;
      color:#555; font-size:13px; font-weight:500; pointer-events:none;
    }
    #pm-zone.loaded #pm-placeholder { display:none; }
    #pm-swap-hint {
      position:absolute; inset:0; background:rgba(0,0,0,0.55);
      display:none; align-items:center; justify-content:center;
      color:#fff; font-size:13px; font-weight:700;
    }
    #pm-zone.loaded:hover #pm-swap-hint { display:flex; }

    /* ── Category manager ── */
    .cat-list { display:flex; flex-direction:column; gap:6px; margin-bottom:16px; min-height:40px; }
    .cat-item {
      display:flex; align-items:center; gap:10px;
      background:#1a1a1a; border:1px solid #2a2a2a; border-radius:8px;
      padding:10px 12px;
    }
    .cat-item-label { font-size:14px; font-weight:600; flex:1; }
    .cat-item-slug  { font-size:11px; color:#555; font-family:monospace; }
    .cat-item-remove {
      width:24px; height:24px; border-radius:50%; background:transparent;
      border:1px solid #333 !important; color:#666; font-size:14px;
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      transition:background 0.15s, color 0.15s; flex-shrink:0;
    }
    .cat-item-remove:hover { background:rgba(224,90,90,0.15); color:#e05a5a; border-color:rgba(224,90,90,0.4) !important; }
    .cat-add-row { display:flex; gap:8px; }
    .cat-add-row .pm-in { margin:0; }
    .cat-add-row button {
      padding:10px 14px; border-radius:8px; background:#1e1e1e;
      border:1px solid #333 !important; color:#c9a84c;
      font-family:'Inter',sans-serif; font-size:13px; font-weight:600;
      cursor:pointer; white-space:nowrap; transition:background 0.15s;
    }
    .cat-add-row button:hover { background:#252525; }
    .cat-empty { color:#555; font-size:13px; text-align:center; padding:12px 0; }
  `;
  document.head.appendChild(style);

  // ── Admin bar ─────────────────────────────────────────────────────────────

  const bar = document.createElement('div');
  bar.id = 'port-admin-bar';
  bar.innerHTML =
    `<div class="port-badge"><span class="port-dot"></span> Admin Mode</div>` +
    `<div class="port-divider"></div>` +
    `<span style="color:#666;font-size:12px;font-family:'Inter',sans-serif;white-space:nowrap">Portfolio</span>` +
    `<div class="port-divider"></div>` +
    `<span class="port-changes" id="port-change-label">No unsaved changes</span>` +
    `<button id="btn-port-discard" disabled>Discard</button>` +
    `<button id="btn-port-publish" disabled>↑ Publish</button>` +
    `<div class="port-spacer"></div>` +
    `<button id="btn-port-add">＋ Add Photo</button>` +
    `<button id="btn-port-cats">⊞ Categories</button>` +
    `<div class="port-divider"></div>` +
    `<button id="btn-port-signout">Sign Out</button>`;
  document.body.appendChild(bar);

  const toast = document.createElement('div');
  toast.id = 'port-toast';
  document.body.appendChild(toast);

  const changeLabel  = document.getElementById('port-change-label');
  const btnDiscard   = document.getElementById('btn-port-discard');
  const btnPublish   = document.getElementById('btn-port-publish');

  document.getElementById('btn-port-signout').addEventListener('click', () => SCV_ADMIN.logout());
  document.getElementById('btn-port-add').addEventListener('click', openUploadModal);
  document.getElementById('btn-port-cats').addEventListener('click', openCatModal);

  // ── Toolbar helpers ───────────────────────────────────────────────────────

  function updateToolbar() {
    const n = countPending();
    if (n === 0) {
      changeLabel.textContent = 'No unsaved changes';
      changeLabel.classList.remove('has-changes');
      btnDiscard.disabled = true;
      btnPublish.disabled = true;
    } else {
      changeLabel.textContent = `${n} unsaved change${n === 1 ? '' : 's'}`;
      changeLabel.classList.add('has-changes');
      btnDiscard.disabled = false;
      btnPublish.disabled = false;
    }
  }

  function showToast(type, msg, ms = 5000) {
    toast.className = type;
    toast.textContent = msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.className = ''; }, ms);
  }

  // ── Text editing (portfolio hero) ─────────────────────────────────────────

  function markEditable(el, path) {
    const original = el.textContent;
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'false');
    el.setAttribute('data-editable', '');
    el.setAttribute('data-original', original);

    el.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
    el.addEventListener('paste', e => {
      e.preventDefault();
      document.execCommand('insertText', false,
        (e.clipboardData || window.clipboardData).getData('text/plain'));
    });

    let wasChanged = false;
    el.addEventListener('input', () => {
      const changed = el.textContent !== original;
      if (changed !== wasChanged) {
        wasChanged = changed;
        el.classList.toggle('is-changed', changed);
        updateToolbar();
      }
    });

    editables.set(path, { el, path, original });
  }

  function setupEditables() {
    const label = document.querySelector('.portfolio-hero .section-label');
    const title = document.querySelector('.portfolio-hero__title');
    const sub   = document.querySelector('.portfolio-hero__sub');
    if (label) markEditable(label, 'page.label');
    if (title) markEditable(title, 'page.headline');
    if (sub)   markEditable(sub,   'page.subheadline');
  }

  // ── Discard ───────────────────────────────────────────────────────────────

  btnDiscard.addEventListener('click', () => {
    editables.forEach(({ el, original }) => {
      el.textContent = original;
      el.classList.remove('is-changed');
    });
    updateToolbar();
    showToast('success', 'Changes discarded.');
  });

  // ── Publish ───────────────────────────────────────────────────────────────

  btnPublish.addEventListener('click', async () => {
    btnPublish.disabled = true;
    btnDiscard.disabled = true;
    btnPublish.textContent = 'Publishing…';

    try {
      const res = await fetch('data/portfolio.json?_=' + Date.now());
      if (!res.ok) throw new Error('Could not reload portfolio.json');
      const data = await res.json();

      let changed = 0;
      editables.forEach(({ el, path, original }) => {
        if (el.textContent !== original) {
          setByPath(data, path, el.textContent.trim());
          changed++;
        }
      });

      if (changed === 0) { btnPublish.textContent = '↑ Publish'; updateToolbar(); return; }

      await SCV_ADMIN.commitJSON('data/portfolio.json', data,
        `Admin: update portfolio page text [${changed} field${changed === 1 ? '' : 's'}]`);

      // Reset originals
      editables.forEach(entry => {
        entry.original = entry.el.textContent;
        entry.el.setAttribute('data-original', entry.original);
        entry.el.classList.remove('is-changed');
      });

      updateToolbar();
      btnPublish.textContent = '↑ Publish';
      showToast('success', 'Portfolio text published — live in < 1 min.');

    } catch (err) {
      console.error('[Portfolio Admin]', err);
      btnDiscard.disabled = false;
      btnPublish.disabled = false;
      btnPublish.textContent = '↑ Publish';
      showToast('error', `Publish failed: ${err.message}`);
    }
  });

  // ── Delete confirmation modal ─────────────────────────────────────────────

  const delBg = document.createElement('div');
  delBg.className = 'port-modal-bg';
  delBg.innerHTML =
    `<div class="port-modal-panel" style="max-width:400px">` +
      `<div class="pm-h">Hide this photo?</div>` +
      `<p class="pm-sub" id="del-msg"></p>` +
      `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;overflow:hidden;margin-bottom:20px;">` +
        `<img id="del-preview" src="" alt="" style="width:100%;height:160px;object-fit:cover;display:block;" />` +
      `</div>` +
      `<div class="pm-actions">` +
        `<button class="pm-btn-cancel" id="del-cancel">Cancel</button>` +
        `<button class="pm-btn-danger" id="del-confirm">Hide Photo</button>` +
      `</div>` +
    `</div>`;
  document.body.appendChild(delBg);

  let delCallback = null;
  const delMsg     = document.getElementById('del-msg');
  const delPreview = document.getElementById('del-preview');
  const delConfirm = document.getElementById('del-confirm');
  const delCancel  = document.getElementById('del-cancel');

  function openDeleteModal(img, onConfirm) {
    delMsg.textContent = `"${img.title}" will be hidden from the portfolio. The file stays in the project and can be restored by setting visible: true in portfolio.json.`;
    delPreview.src = img.src;
    delPreview.alt = img.title;
    delCallback = onConfirm;
    delBg.classList.add('open');
    delConfirm.focus();
  }

  function closeDeleteModal() { delBg.classList.remove('open'); delCallback = null; }

  delCancel.addEventListener('click', closeDeleteModal);
  delBg.addEventListener('click', e => { if (e.target === delBg) closeDeleteModal(); });
  delConfirm.addEventListener('click', async () => {
    if (!delCallback) return;
    delConfirm.disabled = true;
    delConfirm.textContent = 'Hiding…';
    await delCallback();
    delConfirm.disabled = false;
    delConfirm.textContent = 'Hide Photo';
    closeDeleteModal();
  });

  // ── Delete handler (attached to each card) ────────────────────────────────

  function attachDeleteHandler(itemEl, img) {
    let btn = itemEl.querySelector('.port-del-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'port-del-btn';
      btn.setAttribute('aria-label', 'Hide photo');
      btn.title = 'Hide from portfolio';
      btn.textContent = '×';
      itemEl.appendChild(btn);
    }

    btn.addEventListener('click', e => {
      e.stopPropagation();
      openDeleteModal(img, async () => {
        btn.disabled = true;
        try {
          const res = await fetch('data/portfolio.json?_=' + Date.now());
          if (!res.ok) throw new Error('Could not reload portfolio.json');
          const data = await res.json();
          const entry = data.images.find(i => i.src === img.src);
          if (!entry) throw new Error('Entry not found in portfolio.json');
          entry.visible = false;
          await SCV_ADMIN.commitJSON('data/portfolio.json', data,
            `Admin: hide portfolio photo — ${img.title}`);
          itemEl.remove();
          showToast('success', `"${img.title}" hidden. File is still in the project.`);
        } catch (err) {
          console.error('[Portfolio Admin]', err);
          btn.disabled = false;
          showToast('error', `Failed: ${err.message}`);
        }
      });
    });
  }

  // ── Category manager modal ────────────────────────────────────────────────

  const catBg = document.createElement('div');
  catBg.className = 'port-modal-bg';
  catBg.innerHTML =
    `<div class="port-modal-panel">` +
      `<div class="pm-h">Manage Categories</div>` +
      `<p class="pm-sub">Changes update the filter tabs, photo cards, and the Add Photo dropdown. Removing a category doesn't affect existing photos using it.</p>` +
      `<div class="cat-list" id="cat-list"></div>` +
      `<div class="cat-add-row">` +
        `<input type="text" class="pm-in" id="cat-new-input" placeholder="New category name, e.g. Events" />` +
        `<button id="cat-add-btn">Add</button>` +
      `</div>` +
      `<div class="pm-actions">` +
        `<button class="pm-btn-cancel" id="cat-cancel">Cancel</button>` +
        `<button class="pm-btn-primary" id="cat-save">Save Categories</button>` +
      `</div>` +
    `</div>`;
  document.body.appendChild(catBg);

  const catList      = document.getElementById('cat-list');
  const catNewInput  = document.getElementById('cat-new-input');
  const catAddBtn    = document.getElementById('cat-add-btn');
  const catSaveBtn   = document.getElementById('cat-save');
  const catCancel    = document.getElementById('cat-cancel');

  let workingCats = []; // temp copy while modal is open

  function renderCatList() {
    if (workingCats.length === 0) {
      catList.innerHTML = `<div class="cat-empty">No categories yet.</div>`;
      return;
    }
    catList.innerHTML = workingCats.map((c, i) =>
      `<div class="cat-item" data-i="${i}">` +
        `<span class="cat-item-label">${c.label}</span>` +
        `<span class="cat-item-slug">${c.value}</span>` +
        `<button class="cat-item-remove" data-i="${i}" title="Remove">×</button>` +
      `</div>`
    ).join('');
    catList.querySelectorAll('.cat-item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.i);
        workingCats.splice(i, 1);
        renderCatList();
      });
    });
  }

  function openCatModal() {
    workingCats = localCategories.map(c => ({ ...c })); // deep-ish copy
    renderCatList();
    catNewInput.value = '';
    catSaveBtn.textContent = 'Save Categories';
    catSaveBtn.disabled = false;
    catBg.classList.add('open');
    catNewInput.focus();
  }

  function closeCatModal() { catBg.classList.remove('open'); }

  catCancel.addEventListener('click', closeCatModal);
  catBg.addEventListener('click', e => { if (e.target === catBg) closeCatModal(); });

  catNewInput.addEventListener('keydown', e => { if (e.key === 'Enter') catAddBtn.click(); });

  catAddBtn.addEventListener('click', () => {
    const label = catNewInput.value.trim();
    if (!label) return;
    const value = slugify(label);
    if (workingCats.find(c => c.value === value)) {
      catNewInput.style.borderColor = '#e05a5a';
      setTimeout(() => { catNewInput.style.borderColor = ''; }, 1500);
      return;
    }
    workingCats.push({ value, label });
    renderCatList();
    catNewInput.value = '';
    catNewInput.focus();
  });

  catSaveBtn.addEventListener('click', async () => {
    catSaveBtn.disabled = true;
    catSaveBtn.textContent = 'Saving…';
    try {
      const res = await fetch('data/portfolio.json?_=' + Date.now());
      if (!res.ok) throw new Error('Could not reload portfolio.json');
      const data = await res.json();
      data.categories = workingCats;
      await SCV_ADMIN.commitJSON('data/portfolio.json', data,
        `Admin: update portfolio categories`);

      localCategories = workingCats.map(c => ({ ...c }));
      updateFilterButtons();
      populateCategorySelect();
      closeCatModal();
      showToast('success', 'Categories saved — filter tabs updated.');
    } catch (err) {
      console.error('[Portfolio Admin]', err);
      catSaveBtn.disabled = false;
      catSaveBtn.textContent = 'Save Categories';
      showToast('error', `Save failed: ${err.message}`);
    }
  });

  // Re-render the filter tabs on the page from localCategories
  function updateFilterButtons() {
    const inner = document.getElementById('portfolio-filters-inner');
    if (!inner) return;
    inner.innerHTML =
      `<button class="portfolio-filter active" data-filter="all">All</button>` +
      localCategories.map(c =>
        `<button class="portfolio-filter" data-filter="${c.value}">${c.label}</button>`
      ).join('');
    // Re-attach filter click handlers (portfolio.js initialised these from the old buttons)
    inner.querySelectorAll('.portfolio-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        inner.querySelectorAll('.portfolio-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        document.querySelectorAll('.portfolio-item').forEach(item => {
          item.classList.toggle('hidden', filter !== 'all' && item.dataset.category !== filter);
        });
      });
    });
  }

  // Populate the upload modal's category <select> from localCategories
  function populateCategorySelect() {
    const sel = document.getElementById('pm-cat');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = localCategories.map(c =>
      `<option value="${c.value}">${c.label}</option>`
    ).join('');
    if ([...sel.options].find(o => o.value === prev)) sel.value = prev;
  }

  // ── Upload modal ──────────────────────────────────────────────────────────

  const uploadBg = document.createElement('div');
  uploadBg.className = 'port-modal-bg';
  uploadBg.id = 'port-upload-bg';
  uploadBg.innerHTML =
    `<div class="port-modal-panel">` +
      `<div class="pm-h">Add Photo to Portfolio</div>` +

      `<div id="pm-zone">` +
        `<img id="pm-preview" alt="Preview" />` +
        `<div id="pm-placeholder">` +
          `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
            `<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>` +
            `<circle cx="12" cy="13" r="4"/>` +
          `</svg>` +
          `<span>Click to choose image</span>` +
        `</div>` +
        `<div id="pm-swap-hint">Change Image</div>` +
      `</div>` +

      `<div class="pm-field">` +
        `<label class="pm-lbl" for="pm-title">Title</label>` +
        `<input type="text" id="pm-title" class="pm-in" placeholder="e.g. Pittsburgh Skyline" />` +
      `</div>` +
      `<div class="pm-field">` +
        `<label class="pm-lbl" for="pm-cat">Category</label>` +
        `<select id="pm-cat" class="pm-sel"></select>` +
      `</div>` +
      `<div class="pm-field">` +
        `<label class="pm-lbl" for="pm-alt">Alt Text <span class="pm-lbl-note">(for accessibility)</span></label>` +
        `<input type="text" id="pm-alt" class="pm-in" placeholder="e.g. Aerial view of Pittsburgh at sunset" />` +
      `</div>` +

      `<div class="pm-actions">` +
        `<button class="pm-btn-cancel" id="pm-cancel">Cancel</button>` +
        `<button class="pm-btn-primary" id="pm-submit" disabled>Upload Photo</button>` +
      `</div>` +
    `</div>`;
  document.body.appendChild(uploadBg);

  const zone      = document.getElementById('pm-zone');
  const preview   = document.getElementById('pm-preview');
  const titleIn   = document.getElementById('pm-title');
  const altIn     = document.getElementById('pm-alt');
  const submitBtn = document.getElementById('pm-submit');

  const fileIn = document.createElement('input');
  fileIn.type = 'file'; fileIn.accept = 'image/*'; fileIn.style.display = 'none';
  document.body.appendChild(fileIn);

  let selectedFile = null;

  zone.addEventListener('click', () => fileIn.click());
  fileIn.addEventListener('change', () => {
    const f = fileIn.files[0];
    if (!f) return;
    selectedFile = f;
    preview.src = URL.createObjectURL(f);
    zone.classList.add('loaded');
    if (!titleIn.value) {
      titleIn.value = f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
    }
    if (!altIn.value) altIn.value = titleIn.value;
    checkReady();
    fileIn.value = '';
  });

  [titleIn, altIn].forEach(el => el.addEventListener('input', checkReady));

  function checkReady() {
    submitBtn.disabled = !(selectedFile && titleIn.value.trim());
  }

  function openUploadModal() {
    selectedFile = null;
    preview.src = ''; zone.classList.remove('loaded');
    titleIn.value = ''; altIn.value = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Upload Photo';
    populateCategorySelect();
    uploadBg.classList.add('open');
    setTimeout(() => titleIn.focus(), 60);
  }

  function closeUploadModal() { uploadBg.classList.remove('open'); selectedFile = null; }

  document.getElementById('pm-cancel').addEventListener('click', closeUploadModal);
  uploadBg.addEventListener('click', e => { if (e.target === uploadBg) closeUploadModal(); });

  submitBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    const title    = titleIn.value.trim();
    const category = document.getElementById('pm-cat').value;
    const alt      = altIn.value.trim() || title;
    const ext      = selectedFile.name.split('.').pop().toLowerCase();
    const slug     = slugify(title);
    const repoPath = `assets/images/portfolio/${category}/${slug}.${ext}`;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading…';

    try {
      await SCV_ADMIN.uploadFile(repoPath, selectedFile,
        `Admin: add portfolio photo — ${title}`);

      const res = await fetch('data/portfolio.json?_=' + Date.now());
      if (!res.ok) throw new Error('Could not reload portfolio.json');
      const data = await res.json();
      const newEntry = { src: repoPath, alt, category, title };
      data.images.push(newEntry);
      await SCV_ADMIN.commitJSON('data/portfolio.json', data,
        `Admin: add portfolio photo — ${title}`);

      addItemToGrid(newEntry);
      closeUploadModal();
      showToast('success', `"${title}" uploaded and added to the portfolio.`);
    } catch (err) {
      console.error('[Portfolio Admin]', err);
      showToast('error', `Upload failed: ${err.message}`);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Upload Photo';
    }
  });

  // ── Grid item builder ─────────────────────────────────────────────────────

  const CAT_LABELS = () => Object.fromEntries(localCategories.map(c => [c.value, c.label]));

  const ZOOM_SVG =
    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">` +
    `<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;

  function addItemToGrid(img) {
    const grid = document.getElementById('portfolio-grid');
    if (!grid) return;
    const div = document.createElement('div');
    div.className = 'portfolio-item';
    div.dataset.category = img.category;
    const labels = CAT_LABELS();
    div.innerHTML =
      `<div class="portfolio-item__inner">` +
        `<img src="${img.src}" alt="${img.alt}" class="portfolio-item__img" loading="lazy" />` +
        `<div class="portfolio-item__overlay">` +
          `<div class="portfolio-item__info">` +
            `<div class="portfolio-item__category">${labels[img.category] || img.category}</div>` +
            `<div class="portfolio-item__title">${img.title}</div>` +
          `</div>` +
          `<div class="portfolio-item__zoom" aria-label="View full size">${ZOOM_SVG}</div>` +
        `</div>` +
      `</div>` +
      `<button class="port-del-btn" aria-label="Hide photo" title="Hide from portfolio">×</button>`;
    attachDeleteHandler(div, img);
    grid.appendChild(div);
  }

  // ── Global key handler ────────────────────────────────────────────────────

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (delBg.classList.contains('open'))    { closeDeleteModal(); return; }
    if (catBg.classList.contains('open'))    { closeCatModal();    return; }
    if (uploadBg.classList.contains('open')) { closeUploadModal(); return; }
  });

  // ── Preserve admin links ──────────────────────────────────────────────────

  function preserveAdminLinks() {
    document.querySelectorAll('a[href^="index.html"]').forEach(a => {
      const href = a.getAttribute('href');
      if (href.includes('mode=admin')) return;
      const hashIdx = href.indexOf('#');
      if (hashIdx === -1) {
        a.setAttribute('href', href + (href.includes('?') ? '&' : '?') + 'mode=admin');
      } else {
        const base = href.slice(0, hashIdx);
        const hash = href.slice(hashIdx);
        a.setAttribute('href', base + (base.includes('?') ? '&' : '?') + 'mode=admin' + hash);
      }
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  function init() {
    const data = window._portfolioData || {};
    localCategories = (data.categories || []).map(c => ({ ...c }));

    // Text editing
    setupEditables();
    updateToolbar();

    // Delete buttons on existing grid items
    const images = data.images || [];
    document.querySelectorAll('.portfolio-item').forEach((el, i) => {
      attachDeleteHandler(el, images[i] || { title: `Photo ${i + 1}`, src: '' });
    });

    preserveAdminLinks();
    console.log(`[Portfolio Admin] Ready — ${localCategories.length} categories, ${images.length} photos.`);
  }

  if (window._portfolioReady) init();
  else document.addEventListener('portfolio:ready', init, { once: true });

})();
