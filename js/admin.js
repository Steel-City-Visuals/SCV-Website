// ── SCV Admin — Phase 3 + 4 ──
// Phase 3:  Inline text editing with Publish / Discard toolbar.
// Phase 3b: CTA button label + URL editing via popover.
// Phase 4:  Image swap overlays for team photos and partner logos.

(function () {
  if (typeof SCV_ADMIN === 'undefined' || !SCV_ADMIN.isAdminMode()) return;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function setByPath(obj, path, value) {
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
    cur[parts[parts.length - 1]] = value;
  }

  // ── State ─────────────────────────────────────────────────────────────────

  const editables      = new Map();   // contenteditable text fields
  const btnChanges     = new Map();   // CTA button label + href edits
  const pendingNewCards       = [];    // { card, cardEl, wire(finalIndex) } — services
  const pendingDeleteCards    = [];    // { cardEl } — service cards queued for deletion
  const pendingNewPricingCards    = []; // { card, cardEl, wire(finalIndex) } — pricing other-services
  const pendingDeletePricingCards = []; // { cardEl } — pricing cards queued for deletion
  const pendingNewTeamMembers     = []; // { member, cardEl, btnKey, wire(finalIndex) }
  const pendingNewTestimonials    = []; // { testimonial, cardEl, wire(finalIndex) }
  const pendingNewPartners        = []; // { partner, itemEl }
  const pendingDeletePartners     = []; // { itemEl }
  const pendingDeleteTeamMembers  = []; // { cardEl }
  const pendingDeleteTestimonials = []; // { cardEl }

  function countPending() {
    let n = 0;
    editables.forEach(({ el, original }) => { if (el.textContent !== original) n++; });
    btnChanges.forEach(({ hrefPath, labelEl, linkEl, origText, origHref }) => {
      if (hrefPath && hrefPath.startsWith('__pending_')) return; // counted via pendingNew* arrays
      if (labelEl && labelEl.textContent.trim() !== origText) n++;
      if (linkEl.getAttribute('href') !== origHref) n++;
    });
    return n + pendingNewCards.length + pendingDeleteCards.length
             + pendingNewPricingCards.length + pendingDeletePricingCards.length
             + pendingNewTeamMembers.length + pendingNewTestimonials.length
             + pendingNewPartners.length
             + pendingDeletePartners.length + pendingDeleteTeamMembers.length + pendingDeleteTestimonials.length;
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  const style = document.createElement('style');
  style.textContent = `
    /* ── Toolbar ── */
    #scv-admin-bar {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 99999;
      background: #111; border-top: 2px solid #c9a84c;
      display: flex; align-items: center; gap: 12px; padding: 0 20px; height: 56px;
      font-family: 'Inter', sans-serif; font-size: 13px; color: #f0f0f0;
      box-shadow: 0 -4px 24px rgba(0,0,0,0.5);
    }
    .admin-badge { display: flex; align-items: center; gap: 6px; font-weight: 700; color: #c9a84c; white-space: nowrap; }
    .admin-dot { width: 8px; height: 8px; background: #c9a84c; border-radius: 50%; animation: admin-pulse 2s ease-in-out infinite; }
    @keyframes admin-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
    .admin-divider { width: 1px; height: 24px; background: #2a2a2a; flex-shrink: 0; }
    .admin-changes { color: #888; white-space: nowrap; }
    .admin-changes.has-changes { color: #c9a84c; font-weight: 600; }
    .admin-spacer { flex: 1; }
    #scv-admin-bar button {
      border: none; border-radius: 6px; padding: 7px 14px;
      font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;
      cursor: pointer; white-space: nowrap; transition: opacity 0.15s, background 0.15s;
    }
    #scv-admin-bar button:disabled { opacity: 0.4; cursor: not-allowed; }
    #btn-discard { background: transparent; color: #888; border: 1px solid #2a2a2a !important; }
    #btn-discard:hover:not(:disabled) { color: #f0f0f0; border-color: #555 !important; }
    #btn-publish { background: #c9a84c; color: #000; }
    #btn-publish:hover:not(:disabled) { background: #a8873a; }
    #btn-signout { background: transparent; color: #555; border: 1px solid transparent !important; font-size: 12px; }
    #btn-signout:hover { color: #e05a5a; }

    /* ── Toast ── */
    #scv-admin-toast {
      position: fixed; bottom: 68px; right: 20px; z-index: 99998;
      padding: 12px 16px; border-radius: 8px;
      font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500;
      display: none; align-items: center; gap: 8px;
      max-width: 360px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    }
    #scv-admin-toast.success { display:flex; background:rgba(76,175,130,0.15); border:1px solid rgba(76,175,130,0.35); color:#4caf82; }
    #scv-admin-toast.error   { display:flex; background:rgba(224,90,90,0.15);  border:1px solid rgba(224,90,90,0.3);  color:#e05a5a; }

    /* ── Editable text hints ── */
    [data-editable]:hover  { outline:1px dashed rgba(201,168,76,0.5); outline-offset:2px; cursor:text; }
    [data-editable]:focus  { outline:2px solid #c9a84c; outline-offset:2px; border-radius:2px; }
    [data-editable].is-changed { outline:1px solid rgba(201,168,76,0.4); background:rgba(201,168,76,0.05); }

    /* ── Image swap overlays ── */
    .img-swap-wrap { position:relative; display:inline-flex; align-items:center; justify-content:center; }
    .img-swap-btn {
      position:absolute; inset:0;
      background:rgba(0,0,0,0.6); color:#fff;
      border:2px dashed rgba(201,168,76,0.7); border-radius:8px;
      display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px;
      font-family:'Inter',sans-serif; font-size:11px; font-weight:700;
      letter-spacing:0.06em; text-transform:uppercase;
      cursor:pointer; opacity:0; transition:opacity 0.18s; padding:0;
    }
    .img-swap-wrap:hover .img-swap-btn,
    .img-swap-btn.uploading { opacity:1; }
    .img-swap-btn.uploading { background:rgba(0,0,0,0.8); cursor:wait; }

    /* ── Partner admin grid ── */
    .trust__admin-grid {
      display:flex; flex-wrap:wrap; gap:12px; justify-content:center; padding:16px 0;
    }
    .trust__admin-item {
      display:flex; flex-direction:column; align-items:center; gap:8px;
      background:#111; border:1px solid #2a2a2a; border-radius:10px;
      padding:16px 20px; position:relative; cursor:default;
    }
    .trust__admin-item--pending { border-color:#c9a84c55; }
    .trust__admin-name { font-size:11px; color:#555; font-family:'Inter',sans-serif; text-align:center; max-width:120px; }
    .trust__admin-add {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:6px; min-width:120px; min-height:80px;
      border:2px dashed #2a2a2a; border-radius:10px; cursor:pointer;
      color:#444; transition:border-color 0.15s, color 0.15s; padding:16px 20px;
    }
    .trust__admin-add:hover { border-color:#c9a84c; color:#c9a84c; }
    .trust__admin-add span { font-size:12px; font-weight:600; font-family:'Inter',sans-serif; }

    /* Delete button hover triggers for new sections */
    .trust__admin-item { position:relative; }
    .trust__admin-item:hover .svc-del-btn { opacity:1; }
    .trust__admin-item--pending-delete { opacity:0.35; outline:2px solid rgba(224,90,90,0.5); outline-offset:3px; pointer-events:none; }
    .trust__admin-item--pending-delete .svc-del-btn { display:none; }
    [data-team-index] { position:relative; }
    [data-team-index]:hover .svc-del-btn { opacity:1; }
    .team__card--pending-delete { opacity:0.35; outline:2px solid rgba(224,90,90,0.5); outline-offset:3px; pointer-events:none; }
    .team__card--pending-delete .svc-del-btn { display:none; }
    [data-testi-index] { position:relative; }
    [data-testi-index]:hover .svc-del-btn { opacity:1; }
    .testimonials__card--pending-delete { opacity:0.35; outline:2px solid rgba(224,90,90,0.5); outline-offset:3px; pointer-events:none; }
    .testimonials__card--pending-delete .svc-del-btn { display:none; }

    .team__upload-area {
      border:2px dashed #2a2a2a; border-radius:8px; padding:20px;
      display:flex; align-items:center; justify-content:center; min-height:80px;
      color:#555; font-size:13px; font-family:'Inter',sans-serif; transition:border-color 0.15s;
    }
    .team__upload-area:hover { border-color:#555; }

    /* ── CTA button edit indicator ── */
    [data-btn-file] { outline: 1px dashed rgba(201,168,76,0); transition: outline-color 0.15s; }
    [data-btn-file]:hover { outline-color: rgba(201,168,76,0.6); cursor: pointer !important; }

    /* ── Button edit popover ── */
    #scv-btn-popover {
      position: fixed; z-index: 100000;
      background: #1a1a1a; border: 1px solid #333; border-radius: 10px;
      padding: 16px; width: 300px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      font-family: 'Inter', sans-serif;
    }
    #scv-btn-popover[hidden] { display: none; }
    .bpop-title { font-size:11px; font-weight:700; color:#c9a84c; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:12px; }
    .bpop-lbl { display:block; font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:5px; }
    .bpop-row { margin-bottom: 10px; }
    .bpop-row[hidden] { display: none; }
    .bpop-input {
      width:100%; background:#0a0a0a; border:1px solid #333; border-radius:6px;
      padding:8px 10px; color:#f0f0f0; font-family:'Inter',sans-serif; font-size:13px;
      outline:none; transition:border-color 0.15s; box-sizing:border-box;
    }
    .bpop-input:focus { border-color:#c9a84c; }
    .bpop-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:4px; }
    .bpop-actions button { padding:7px 14px; border-radius:6px; font-family:'Inter',sans-serif; font-size:12px; font-weight:700; cursor:pointer; border:none; }
    #bpop-cancel { background:transparent; color:#888; border:1px solid #333 !important; }
    #bpop-cancel:hover { color:#f0f0f0; }
    #bpop-apply { background:#c9a84c; color:#000; }
    #bpop-apply:hover { background:#a8873a; }

    body { padding-bottom: 56px !important; }

    /* ── Spotlight button on service cards ── */
    .svc-spotlight-btn {
      position:absolute; top:10px; right:10px; z-index:10;
      width:28px; height:28px; border-radius:50%; padding:0;
      background:rgba(20,20,20,0.75); border:1px solid #333 !important;
      color:#555; cursor:pointer; display:flex; align-items:center; justify-content:center;
      opacity:0; transition:opacity 0.15s, color 0.15s, background 0.15s;
    }
    [data-card-json-index]:hover .svc-spotlight-btn { opacity:1; }
    .svc-spotlight-btn:hover { color:#c9a84c; border-color:#c9a84c !important; background:rgba(201,168,76,0.12) !important; }
    .svc-spotlight-btn.is-active { opacity:1; color:#c9a84c; border-color:rgba(201,168,76,0.5) !important; }
    [data-card-json-index] { position:relative; }

    /* ── Service card delete button ── */
    .svc-del-btn {
      position:absolute; top:10px; right:10px; z-index:10;
      width:26px; height:26px; border-radius:50%; padding:0;
      background:rgba(20,20,20,0.75); border:1px solid rgba(224,90,90,0.3) !important;
      color:#666; cursor:pointer; display:flex; align-items:center; justify-content:center;
      font-size:16px; line-height:1;
      opacity:0; transition:opacity 0.15s, background 0.15s, color 0.15s;
    }
    [data-card-json-index]:hover .svc-del-btn { opacity:1; }
    .svc-del-btn:hover { background:rgba(224,90,90,0.85) !important; color:#fff; border-color:transparent !important; }
    .svc-del-btn:disabled { cursor:not-allowed; opacity:0.4 !important; }

    /* ── Pending (queued for deletion) service card ── */
    .services__card--pending-delete {
      opacity:0.35; outline:2px solid rgba(224,90,90,0.5); outline-offset:3px; pointer-events:none;
    }
    .services__card--pending-delete .svc-del-btn { display:none; }

    /* ── Add Service card ── */
    .services__card--add {
      border:2px dashed #2a2a2a !important; background:transparent !important;
      display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;
      color:#444; cursor:pointer; min-height:140px;
      transition:border-color 0.15s, color 0.15s;
    }
    .services__card--add:hover { border-color:#c9a84c !important; color:#c9a84c; }
    .services__card--add span { font-size:13px; font-weight:600; font-family:'Inter',sans-serif; }

    /* ── Pricing card delete button (mirrors .svc-del-btn) ── */
    [data-other-index] { position:relative; }
    [data-other-index]:hover .svc-del-btn { opacity:1; }

    /* ── Testimonials admin grid ── */
    .testimonials__admin-grid {
      display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));
      gap:20px; padding:0 0 32px;
    }
    .testimonials__admin-grid .testimonials__card {
      position:relative; width:auto; flex-shrink:1; min-height:0; padding:20px;
    }
    .testimonials__admin-grid .testimonials__quote { font-size:0.82rem; line-height:1.5; flex:none; }
    .testimonials__admin-grid .testimonials__card::before { font-size:3rem; top:10px; right:12px; }
    .testimonials__card--add {
      border:2px dashed #2a2a2a !important; background:transparent !important;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:8px; color:#444; cursor:pointer; min-height:160px;
      transition:border-color 0.15s, color 0.15s; border-radius:12px;
    }
    .testimonials__card--add:hover { border-color:#c9a84c !important; color:#c9a84c; }
    .testimonials__card--add span { font-size:13px; font-weight:600; font-family:'Inter',sans-serif; }

    /* ── Add Service modal ── */
    .svc-modal-bg {
      position:fixed; inset:0; z-index:10000;
      background:rgba(0,0,0,0.78);
      display:none; align-items:center; justify-content:center; padding:20px;
    }
    .svc-modal-bg.open { display:flex; }
    .svc-modal-panel {
      background:#141414; border:1px solid #2a2a2a; border-radius:14px;
      padding:28px; width:100%; max-width:460px;
      font-family:'Inter',sans-serif; color:#f0f0f0;
    }
    .svc-modal-panel .pm-h { font-size:18px; font-weight:700; margin-bottom:6px; }
    .svc-modal-panel .pm-sub { font-size:13px; color:#888; margin-bottom:20px; line-height:1.5; }
    .svc-modal-panel .pm-field { margin-bottom:14px; }
    .svc-modal-panel .pm-lbl { display:block; font-size:11px; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px; }
    .svc-modal-panel .pm-in, .svc-modal-panel .pm-sel, .svc-modal-panel .pm-ta {
      width:100%; background:#0a0a0a; border:1px solid #2a2a2a; border-radius:8px;
      padding:10px 12px; color:#f0f0f0; font-family:'Inter',sans-serif; font-size:14px;
      outline:none; transition:border-color 0.15s; box-sizing:border-box; resize:vertical;
    }
    .svc-modal-panel .pm-in:focus, .svc-modal-panel .pm-sel:focus, .svc-modal-panel .pm-ta:focus { border-color:#c9a84c; }
    .svc-modal-panel .pm-sel option { background:#141414; }
    .svc-modal-panel .pm-actions { display:flex; gap:10px; justify-content:flex-end; margin-top:22px; }
    .svc-modal-panel .pm-actions button {
      padding:10px 20px; border-radius:8px;
      font-family:'Inter',sans-serif; font-size:14px; font-weight:700;
      cursor:pointer; border:none; transition:background 0.15s, opacity 0.15s;
    }
    .svc-modal-panel .pm-btn-cancel { background:transparent; color:#888; border:1px solid #2a2a2a !important; }
    .svc-modal-panel .pm-btn-cancel:hover { color:#f0f0f0; }
    .svc-modal-panel .pm-btn-primary { background:#c9a84c; color:#000; }
    .svc-modal-panel .pm-btn-primary:hover:not(:disabled) { background:#a8873a; }
    .svc-modal-panel .pm-btn-primary:disabled { opacity:0.4; cursor:not-allowed; }
    .pm-btn-danger { background:#e05a5a; color:#fff; border:none; border-radius:8px; padding:10px 22px; font-size:14px; font-weight:600; cursor:pointer; }
    .pm-btn-danger:hover { background:#c94444; }
  `;
  document.head.appendChild(style);

  // ── Toolbar ───────────────────────────────────────────────────────────────

  const bar = document.createElement('div');
  bar.id = 'scv-admin-bar';
  bar.innerHTML =
    `<div class="admin-badge"><span class="admin-dot"></span> Admin Mode</div>` +
    `<div class="admin-divider"></div>` +
    `<div class="admin-changes" id="admin-change-label">No unsaved changes</div>` +
    `<div class="admin-spacer"></div>` +
    `<button id="btn-discard" disabled>Discard</button>` +
    `<button id="btn-publish" disabled>↑ Publish Changes</button>` +
    `<div class="admin-divider"></div>` +
    `<button id="btn-signout">Sign Out</button>`;
  document.body.appendChild(bar);

  const toast = document.createElement('div');
  toast.id = 'scv-admin-toast';
  document.body.appendChild(toast);

  const changeLabel = document.getElementById('admin-change-label');
  const btnDiscard  = document.getElementById('btn-discard');
  const btnPublish  = document.getElementById('btn-publish');

  document.getElementById('btn-signout').addEventListener('click', () => SCV_ADMIN.logout());

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

  function showToast(type, message, ms = 5000) {
    toast.className = type;
    toast.textContent = message;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.className = ''; }, ms);
  }

  // ── Phase 3: Contenteditable text fields ──────────────────────────────────

  function markEditable(el, file, path) {
    const key = `${file}|${path}`;
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

    editables.set(key, { el, file, path, original });
  }

  // Makes an element inline-editable immediately (for pending cards before publish).
  // Doesn't register in the editables Map — use markEditable after publish for full tracking.
  function makeEditableDraft(el) {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'false');
    el.setAttribute('data-editable', '');
    el.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
  }

  function setupEditables() {
    // ── Hero ──
    document.querySelectorAll('[data-badge-index]').forEach(el =>
      markEditable(el, 'data/site.json', `hero.badges[${el.dataset.badgeIndex}]`)
    );
    const hl1 = document.querySelector('.hero__hl1');
    if (hl1) markEditable(hl1, 'data/site.json', 'hero.headlineLine1');
    const heroAccent = document.querySelector('.hero__headline-accent');
    if (heroAccent) markEditable(heroAccent, 'data/site.json', 'hero.headlineAccent');
    const heroSub = document.querySelector('.hero__sub');
    if (heroSub) markEditable(heroSub, 'data/site.json', 'hero.subheadline');

    // ── Services header ──
    const svcHdr = document.querySelector('#services .services__header');
    if (svcHdr) {
      const l = svcHdr.querySelector('.section-label');  if (l) markEditable(l, 'data/services.json', 'header.label');
      const t = svcHdr.querySelector('.section-title');  if (t) markEditable(t, 'data/services.json', 'header.title');
      const s = svcHdr.querySelector('.section-subtitle'); if (s) markEditable(s, 'data/services.json', 'header.subtitle');
    }

    // ── Services featured ──
    const feat = document.querySelector('.services__featured');
    if (feat) {
      const tag  = feat.querySelector('.services__featured-tag');   if (tag)  markEditable(tag,  'data/services.json', 'featured.tag');
      const ttl  = feat.querySelector('.services__featured-title'); if (ttl)  markEditable(ttl,  'data/services.json', 'featured.title');
      const dsc  = feat.querySelector('.services__featured-desc');  if (dsc)  markEditable(dsc,  'data/services.json', 'featured.description');
      feat.querySelectorAll('[data-fi-index]').forEach(el =>
        markEditable(el, 'data/services.json', `featured.includes[${el.dataset.fiIndex}]`)
      );
    }

    // ── Service cards ──
    document.querySelectorAll('[data-card-json-index]').forEach(el => {
      const i = el.dataset.cardJsonIndex;
      const t = el.querySelector('.services__card-title'); if (t) markEditable(t, 'data/services.json', `cards[${i}].title`);
      const d = el.querySelector('.services__card-desc');  if (d) markEditable(d, 'data/services.json', `cards[${i}].description`);
    });

    // ── Pricing header ──
    const pHdr = document.querySelector('#pricing .pricing__header');
    if (pHdr) {
      const l = pHdr.querySelector('.section-label');    if (l) markEditable(l, 'data/pricing.json', 'header.label');
      const t = pHdr.querySelector('.section-title');    if (t) markEditable(t, 'data/pricing.json', 'header.title');
      const s = pHdr.querySelector('.section-subtitle'); if (s) markEditable(s, 'data/pricing.json', 'header.subtitle');
    }

    // ── Pricing real estate block ──
    const reTitle = document.querySelector('[data-pricing-re-title]');
    if (reTitle) markEditable(reTitle, 'data/pricing.json', 'realEstate.title');
    const reBlock = document.querySelector('.pricing__re-block');
    if (reBlock) {
      const rl = reBlock.querySelector('.pricing__re-label'); if (rl) markEditable(rl, 'data/pricing.json', 'realEstate.label');
      const rd = reBlock.querySelector('.pricing__re-desc');  if (rd) markEditable(rd, 'data/pricing.json', 'realEstate.description');
      reBlock.querySelectorAll('[data-rei-index]').forEach(el =>
        markEditable(el, 'data/pricing.json', `realEstate.includes[${el.dataset.reiIndex}]`)
      );
      const cl = reBlock.querySelector('.pricing__re-cta-label'); if (cl) markEditable(cl, 'data/pricing.json', 'realEstate.ctaLabel');
      const cs = reBlock.querySelector('.pricing__re-cta-sub');   if (cs) markEditable(cs, 'data/pricing.json', 'realEstate.ctaSub');
      const cn = reBlock.querySelector('.pricing__re-note');       if (cn) markEditable(cn, 'data/pricing.json', 'realEstate.ctaNote');
    }

    // ── Pricing other services ──
    const otherTitle = document.querySelector('[data-pricing-other-title]');
    if (otherTitle) markEditable(otherTitle, 'data/pricing.json', 'otherServices.title');
    const otherSub = document.querySelector('[data-pricing-other-sub]');
    if (otherSub) markEditable(otherSub, 'data/pricing.json', 'otherServices.subtitle');
    document.querySelectorAll('[data-other-index]').forEach(el => {
      const i = el.dataset.otherIndex;
      const n = el.querySelector('.pricing__other-name');  if (n) markEditable(n, 'data/pricing.json', `otherServices.cards[${i}].name`);
      const p = el.querySelector('.pricing__other-price'); if (p) markEditable(p, 'data/pricing.json', `otherServices.cards[${i}].price`);
      const d = el.querySelector('.pricing__other-desc');  if (d) markEditable(d, 'data/pricing.json', `otherServices.cards[${i}].description`);
    });

    // ── Stats ──
    document.querySelectorAll('[data-stat-index]').forEach(el => {
      const i = el.dataset.statIndex;
      const l = el.querySelector('.stats__label'); if (l) markEditable(l, 'data/site.json', `stats[${i}].label`);
      const s = el.querySelector('.stats__sub');   if (s) markEditable(s, 'data/site.json', `stats[${i}].sub`);
    });

    // ── About ──
    const aHL1 = document.querySelector('.about__hl1'); if (aHL1) markEditable(aHL1, 'data/site.json', 'about.headlineLine1');
    const aHL2 = document.querySelector('.about__hl2'); if (aHL2) markEditable(aHL2, 'data/site.json', 'about.headlineLine2');
    document.querySelectorAll('[data-body-index]').forEach(el =>
      markEditable(el, 'data/site.json', `about.body[${el.dataset.bodyIndex}]`)
    );
    document.querySelectorAll('[data-pillar-index]').forEach(el => {
      const i = el.dataset.pillarIndex;
      const t = el.querySelector('.about__pillar-title'); if (t) markEditable(t, 'data/site.json', `about.pillars[${i}].title`);
      const s = el.querySelector('.about__pillar-sub');   if (s) markEditable(s, 'data/site.json', `about.pillars[${i}].sub`);
    });

    // ── Team header ──
    const teamLabel = document.querySelector('[data-team-label]');
    if (teamLabel) markEditable(teamLabel, 'data/site.json', 'about.teamLabel');
    const teamTitle = document.querySelector('[data-team-title]');
    if (teamTitle) markEditable(teamTitle, 'data/site.json', 'about.teamTitle');

    // ── Team ──
    document.querySelectorAll('[data-team-index]').forEach(el => {
      const i = el.dataset.teamIndex;
      const n = el.querySelector('.team__name');  if (n) markEditable(n, 'data/team.json', `[${i}].name`);
      const t = el.querySelector('.team__title'); if (t) markEditable(t, 'data/team.json', `[${i}].title`);
      const b = el.querySelector('.team__bio');   if (b) markEditable(b, 'data/team.json', `[${i}].bio`);
    });

    // ── Testimonials header ──
    const testiLabel = document.querySelector('[data-testi-label]');
    if (testiLabel) markEditable(testiLabel, 'data/site.json', 'testimonialsHeader.label');
    const testiTitle = document.querySelector('[data-testi-title]');
    if (testiTitle) markEditable(testiTitle, 'data/site.json', 'testimonialsHeader.title');

    // ── Testimonials ──
    document.querySelectorAll('[data-testi-index]').forEach(el => {
      const i = el.dataset.testiIndex;
      const q = el.querySelector('.testimonials__quote'); if (q) markEditable(q, 'data/testimonials.json', `[${i}].quote`);
      const n = el.querySelector('.testimonials__name');  if (n) markEditable(n, 'data/testimonials.json', `[${i}].name`);
      const r = el.querySelector('.testimonials__role');  if (r) markEditable(r, 'data/testimonials.json', `[${i}].role`);
    });

    // ── Contact ──
    const cEl = document.getElementById('contact');
    if (cEl) {
      const l = cEl.querySelector('.section-label');  if (l) markEditable(l, 'data/site.json', 'contact.label');
      const h = cEl.querySelector('.section-title');  if (h) markEditable(h, 'data/site.json', 'contact.headline');
      const i = cEl.querySelector('.contact__intro'); if (i) markEditable(i, 'data/site.json', 'contact.intro');
      const emailEl = cEl.querySelector('[data-contact-email]');
      if (emailEl) {
        markEditable(emailEl, 'data/site.json', 'contact.email');
        // Keep mailto: href in sync as user types
        emailEl.addEventListener('input', () => {
          emailEl.setAttribute('href', 'mailto:' + emailEl.textContent.trim());
        });
      }
    }
    document.querySelectorAll('[data-addr-index]').forEach(el =>
      markEditable(el, 'data/site.json', `contact.address[${el.dataset.addrIndex}]`)
    );

    // ── Footer ──
    const ft = document.querySelector('.footer__tagline');
    if (ft) markEditable(ft, 'data/site.json', 'footer.tagline');
    const fc = document.querySelector('.footer__copyright');
    if (fc) markEditable(fc, 'data/site.json', 'footer.copyright');
    document.querySelectorAll('[data-footer-addr-index]').forEach(el =>
      markEditable(el, 'data/site.json', `contact.address[${el.dataset.footerAddrIndex}]`)
    );
    const fEmail = document.querySelector('.footer__email');
    if (fEmail) markEditable(fEmail, 'data/site.json', 'contact.email');
  }

  // ── Phase 3b: Button label + URL editing ─────────────────────────────────

  function setupButtonEditing() {
    const popover = document.createElement('div');
    popover.id = 'scv-btn-popover';
    popover.hidden = true;
    popover.innerHTML =
      `<div class="bpop-title">Edit Button</div>` +
      `<div class="bpop-row" id="bpop-text-row">` +
        `<label class="bpop-lbl" for="bpop-label-in">Label</label>` +
        `<input type="text" id="bpop-label-in" class="bpop-input" placeholder="Button text" />` +
      `</div>` +
      `<div class="bpop-row">` +
        `<label class="bpop-lbl" for="bpop-url-in">URL</label>` +
        `<input type="text" id="bpop-url-in" class="bpop-input" placeholder="https://…" />` +
      `</div>` +
      `<div class="bpop-actions">` +
        `<button id="bpop-cancel">Cancel</button>` +
        `<button id="bpop-apply">Apply</button>` +
      `</div>`;
    document.body.appendChild(popover);

    const textRow   = document.getElementById('bpop-text-row');
    const labelIn   = document.getElementById('bpop-label-in');
    const urlIn     = document.getElementById('bpop-url-in');
    const popApply  = document.getElementById('bpop-apply');
    const popCancel = document.getElementById('bpop-cancel');
    let activeKey   = null;

    function closePopover() { popover.hidden = true; activeKey = null; }

    function openPopover(key, anchor) {
      const entry = btnChanges.get(key);
      textRow.hidden = !entry.textPath;
      labelIn.value  = entry.labelEl ? entry.labelEl.textContent.trim() : '';
      urlIn.value    = entry.linkEl.getAttribute('href') || '';
      activeKey = key;

      // Position: prefer above the button, shift left if too close to right edge
      const rect = anchor.getBoundingClientRect();
      const popH = 190; // estimated popover height
      let top = rect.top - popH - 8;
      if (top < 8) top = rect.bottom + 8; // flip below if not enough room above
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - 316));

      popover.style.top  = top + 'px';
      popover.style.left = left + 'px';
      popover.hidden = false;
      (entry.textPath ? labelIn : urlIn).focus();
    }

    // Close when clicking outside
    document.addEventListener('click', e => {
      if (!popover.hidden && !popover.contains(e.target)) closePopover();
    }, true);

    popCancel.addEventListener('click', closePopover);

    popApply.addEventListener('click', () => {
      if (!activeKey) return;
      const entry = btnChanges.get(activeKey);
      const newText = labelIn.value.trim();
      const newHref = urlIn.value.trim();
      if (entry.labelEl && newText) entry.labelEl.textContent = newText;
      if (newHref) entry.linkEl.setAttribute('href', newHref);

      // Sync mobile mirror (nav links / CTA)
      if (entry.mirrorEl) {
        const mirrorLabel = entry.mirrorEl.querySelector('.btn-label');
        if (mirrorLabel && newText) mirrorLabel.textContent = newText;
        if (newHref) entry.mirrorEl.setAttribute('href', newHref);
      }

      closePopover();
      updateToolbar();
    });

    // Support Enter key inside inputs
    [labelIn, urlIn].forEach(inp =>
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') popApply.click(); })
    );

    // Register a single [data-btn-file] element — also called for dynamically added cards
    function registerBtnEl(linkEl) {
      const file     = linkEl.dataset.btnFile;
      const textPath = linkEl.dataset.btnTextPath || null;
      const hrefPath = linkEl.dataset.btnHrefPath;
      const labelEl  = linkEl.querySelector('.btn-label');
      const key      = `${file}|${hrefPath}`;

      // Mirror element: desktop nav links sync to their mobile counterpart
      let mirrorEl = null;
      if (linkEl.dataset.navI !== undefined) {
        mirrorEl = document.querySelector(`[data-nav-mobile-i="${linkEl.dataset.navI}"]`);
      } else if ('navCta' in linkEl.dataset) {
        mirrorEl = document.querySelector('[data-nav-mobile-cta]');
      }

      btnChanges.set(key, {
        file, textPath, hrefPath, labelEl, linkEl, mirrorEl,
        origText: labelEl ? labelEl.textContent.trim() : '',
        origHref: linkEl.getAttribute('href'),
      });

      linkEl.addEventListener('click', e => {
        if (e.shiftKey) {
          // Shift+click follows the link — preserve admin mode for internal pages
          const href = linkEl.getAttribute('href') || '';
          const isInternal = !href.startsWith('http') && !href.startsWith('#');
          if (isInternal && !href.includes('mode=admin')) {
            e.preventDefault();
            window.location.href = href + (href.includes('?') ? '&' : '?') + 'mode=admin';
          }
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        openPopover(key, linkEl);
      });
    }

    // Register all existing CTA buttons, nav links, and footer links
    document.querySelectorAll('[data-btn-file]').forEach(registerBtnEl);

    // Expose for dynamically added elements (e.g. newly published pricing cards)
    window._scvRegisterBtnEl = registerBtnEl;
  }

  // ── Phase 4: Image swapping ───────────────────────────────────────────────

  const imgFileInput = document.createElement('input');
  imgFileInput.type = 'file';
  imgFileInput.accept = 'image/*';
  imgFileInput.style.display = 'none';
  document.body.appendChild(imgFileInput);

  let pendingUpload = null;
  imgFileInput.addEventListener('change', async () => {
    const file = imgFileInput.files[0];
    if (file && pendingUpload) await pendingUpload(file);
    imgFileInput.value = '';
    pendingUpload = null;
  });

  const cameraSvg =
    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>` +
    `<circle cx="12" cy="13" r="4"/></svg>`;

  function makeSwappable(img, wrap, repoPath) {
    wrap.classList.add('img-swap-wrap');  // activates the hover CSS rule
    wrap.style.position = 'relative';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'img-swap-btn';
    btn.innerHTML = cameraSvg + `<span>Replace</span>`;
    wrap.appendChild(btn);
    img.dataset.origSrc = img.getAttribute('src');

    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const lbl = btn.querySelector('span');

      pendingUpload = async file => {
        lbl.textContent = 'Uploading…';
        btn.classList.add('uploading');
        btn.disabled = true;
        img.src = URL.createObjectURL(file);
        try {
          await SCV_ADMIN.uploadFile(repoPath, file,
            `Admin: replace ${repoPath.split('/').pop()}`);
          showToast('success', 'Image uploaded — live after GitHub Pages rebuilds (< 1 min).');
        } catch (err) {
          img.src = img.dataset.origSrc;
          showToast('error', `Upload failed: ${err.message}`);
        }
        lbl.textContent = 'Replace';
        btn.classList.remove('uploading');
        btn.disabled = false;
      };

      imgFileInput.click();
    });
  }

  function setupImageSwap() {
    // Nav logo — <a class="nav__logo"> is the natural wrap
    const navLogoImg = document.querySelector('.nav__logo img');
    const navLogoWrap = document.querySelector('.nav__logo');
    if (navLogoImg && navLogoWrap) makeSwappable(navLogoImg, navLogoWrap, navLogoImg.getAttribute('src'));

    // Footer logo — wrap in a div (logo sits directly in .footer__brand)
    const footerLogoImg = document.querySelector('.footer__logo');
    if (footerLogoImg) {
      const wrapper = document.createElement('div');
      footerLogoImg.parentNode.insertBefore(wrapper, footerLogoImg);
      wrapper.appendChild(footerLogoImg);
      makeSwappable(footerLogoImg, wrapper, footerLogoImg.getAttribute('src'));
    }

    // Team photos — .team__photo-wrap is already a container
    document.querySelectorAll('[data-team-index]').forEach(el => {
      const img  = el.querySelector('.team__photo');
      const wrap = el.querySelector('.team__photo-wrap');
      if (img && wrap) makeSwappable(img, wrap, img.getAttribute('src'));
    });

    // Partner logos — in non-admin mode wrap each logo for the overlay;
    // admin mode handles this inside setupPartnerAdmin() with the grid items as wrappers
    if (!SCV_ADMIN.isAdminMode()) {
      document.querySelectorAll('#trust .trust__logo:not([aria-hidden])').forEach(img => {
        const wrapper = document.createElement('div');
        img.parentNode.insertBefore(wrapper, img);
        wrapper.appendChild(img);
        makeSwappable(img, wrapper, img.getAttribute('src'));
      });
    }
  }

  // ── Discard ───────────────────────────────────────────────────────────────

  btnDiscard.addEventListener('click', () => {
    editables.forEach(({ el, original }) => {
      el.textContent = original;
      el.classList.remove('is-changed');
      // Restore mailto: href for the contact email link
      if (el.hasAttribute('data-contact-email')) el.setAttribute('href', 'mailto:' + original);
    });
    btnChanges.forEach(({ labelEl, linkEl, origText, origHref, mirrorEl }) => {
      if (labelEl) labelEl.textContent = origText;
      linkEl.setAttribute('href', origHref);
      if (mirrorEl) {
        const mirrorLabel = mirrorEl.querySelector('.btn-label');
        if (mirrorLabel) mirrorLabel.textContent = origText;
        mirrorEl.setAttribute('href', origHref);
      }
    });
    // Remove any pending (unpublished) new service/pricing cards
    pendingNewCards.forEach(({ cardEl }) => cardEl.remove());
    pendingNewCards.length = 0;
    pendingNewPricingCards.forEach(({ cardEl, btnKey }) => {
      cardEl.remove();
      if (btnKey) btnChanges.delete(btnKey);
    });
    pendingNewPricingCards.length = 0;
    pendingNewTeamMembers.forEach(({ cardEl, btnKey }) => {
      cardEl.remove();
      if (btnKey) btnChanges.delete(btnKey);
    });
    pendingNewTeamMembers.length = 0;
    pendingNewTestimonials.forEach(({ cardEl }) => cardEl.remove());
    pendingNewTestimonials.length = 0;
    pendingNewPartners.forEach(({ itemEl }) => itemEl.remove());
    pendingNewPartners.length = 0;
    // Restore any service cards queued for deletion
    pendingDeleteCards.forEach(({ cardEl }) => cardEl.classList.remove('services__card--pending-delete'));
    pendingDeleteCards.length = 0;
    // Restore any pricing cards queued for deletion
    pendingDeletePricingCards.forEach(({ cardEl }) => cardEl.classList.remove('services__card--pending-delete'));
    pendingDeletePricingCards.length = 0;
    pendingDeletePartners.forEach(({ itemEl }) => itemEl.classList.remove('trust__admin-item--pending-delete'));
    pendingDeletePartners.length = 0;
    pendingDeleteTeamMembers.forEach(({ cardEl }) => cardEl.classList.remove('team__card--pending-delete'));
    pendingDeleteTeamMembers.length = 0;
    pendingDeleteTestimonials.forEach(({ cardEl }) => cardEl.classList.remove('testimonials__card--pending-delete'));
    pendingDeleteTestimonials.length = 0;
    updateToolbar();
    showToast('success', 'Changes discarded.');
  });

  // ── Publish ───────────────────────────────────────────────────────────────

  btnPublish.addEventListener('click', async () => {
    btnPublish.disabled = true;
    btnDiscard.disabled = true;
    btnPublish.textContent = 'Publishing…';

    const fileChanges = new Map();
    const push = (file, path, value) => {
      if (!fileChanges.has(file)) fileChanges.set(file, []);
      fileChanges.get(file).push({ path, value });
    };

    editables.forEach(({ el, file, path, original }) => {
      if (el.textContent !== original) push(file, path, el.textContent.trim());
    });
    btnChanges.forEach(({ file, textPath, hrefPath, labelEl, linkEl, origText, origHref }) => {
      const ct = labelEl ? labelEl.textContent.trim() : null;
      const ch = linkEl.getAttribute('href');
      if (textPath && ct && ct !== origText) push(file, textPath, ct);
      if (hrefPath && ch !== origHref)       push(file, hrefPath, ch);
    });

    // Ensure testimonials.json is in fileChanges if there are pending new testimonials
    if (pendingNewTestimonials.length > 0 && !fileChanges.has('data/testimonials.json')) {
      fileChanges.set('data/testimonials.json', []);
    }

    // Ensure partners.json is in fileChanges if there are pending new logos or deletes
    if ((pendingNewPartners.length > 0 || pendingDeletePartners.length > 0) && !fileChanges.has('data/partners.json')) {
      fileChanges.set('data/partners.json', []);
    }

    // Ensure team.json is in fileChanges if there are pending new members or deletes
    if ((pendingNewTeamMembers.length > 0 || pendingDeleteTeamMembers.length > 0) && !fileChanges.has('data/team.json')) {
      fileChanges.set('data/team.json', []);
    }
    if (pendingDeleteTestimonials.length > 0 && !fileChanges.has('data/testimonials.json')) {
      fileChanges.set('data/testimonials.json', []);
    }

    // Ensure services.json is in fileChanges if there are pending card adds/deletes
    if ((pendingNewCards.length > 0 || pendingDeleteCards.length > 0) && !fileChanges.has('data/services.json')) {
      fileChanges.set('data/services.json', []);
    }
    // Ensure pricing.json is in fileChanges if there are pending pricing card changes
    if ((pendingNewPricingCards.length > 0 || pendingDeletePricingCards.length > 0) && !fileChanges.has('data/pricing.json')) {
      fileChanges.set('data/pricing.json', []);
    }

    if (fileChanges.size === 0) {
      btnPublish.textContent = '↑ Publish Changes';
      updateToolbar();
      return;
    }

    try {
      const commits = [];
      for (const [file, changes] of fileChanges) {
        const res = await fetch(file + '?_=' + Date.now());
        if (!res.ok) throw new Error(`Could not reload ${file}`);
        const data = await res.json();
        for (const { path, value } of changes) setByPath(data, path, value);

        // Apply pending deletes and adds to partners.json
        if (file === 'data/partners.json') {
          if (pendingDeletePartners.length > 0) {
            const deleteIndices = pendingDeletePartners
              .map(({ itemEl }) => parseInt(itemEl.dataset.partnerIndex))
              .sort((a, b) => b - a);
            deleteIndices.forEach(i => data.splice(i, 1));
          }
          if (pendingNewPartners.length > 0) {
            pendingNewPartners.forEach(({ partner }) => data.push(partner));
          }
        }

        // Apply pending deletes and adds to testimonials.json
        if (file === 'data/testimonials.json') {
          if (pendingDeleteTestimonials.length > 0) {
            const deleteIndices = pendingDeleteTestimonials
              .map(({ cardEl }) => parseInt(cardEl.dataset.testiIndex))
              .sort((a, b) => b - a);
            deleteIndices.forEach(i => data.splice(i, 1));
          }
          if (pendingNewTestimonials.length > 0) {
            const startIndex = data.length;
            pendingNewTestimonials.forEach((item, i) => {
              const qEl = item.cardEl.querySelector('.testimonials__quote');
              const nEl = item.cardEl.querySelector('.testimonials__name');
              const rEl = item.cardEl.querySelector('.testimonials__role');
              if (qEl) item.testimonial.quote = qEl.textContent.replace(/^"|"$/g, '').trim();
              if (nEl) item.testimonial.name  = nEl.textContent.trim();
              if (rEl) item.testimonial.role  = rEl.textContent.trim();
              data.push(item.testimonial);
              item.finalIndex = startIndex + i;
            });
          }
        }

        // Apply pending deletes and adds to team.json
        if (file === 'data/team.json') {
          if (pendingDeleteTeamMembers.length > 0) {
            const deleteIndices = pendingDeleteTeamMembers
              .map(({ cardEl }) => parseInt(cardEl.dataset.teamIndex))
              .sort((a, b) => b - a);
            deleteIndices.forEach(i => data.splice(i, 1));
          }
          if (pendingNewTeamMembers.length > 0) {
            const startIndex = data.length;
            pendingNewTeamMembers.forEach((item, i) => {
              // Read latest draft edits from DOM
              const nameEl = item.cardEl.querySelector('.team__name');
              const titleEl = item.cardEl.querySelector('.team__title');
              const bioEl   = item.cardEl.querySelector('.team__bio');
              if (nameEl)  item.member.name  = nameEl.textContent.trim();
              if (titleEl) item.member.title = titleEl.textContent.trim();
              if (bioEl)   item.member.bio   = bioEl.textContent.trim();
              // Read LinkedIn URL from btnChanges
              const btnEntry = item.btnKey ? btnChanges.get(item.btnKey) : null;
              if (btnEntry) item.member.linkedin = btnEntry.linkEl.getAttribute('href') || item.member.linkedin;
              data.push(item.member);
              item.finalIndex = startIndex + i;
            });
          }
        }

        // Apply pending deletes and adds to pricing.json otherServices
        if (file === 'data/pricing.json') {
          if (pendingDeletePricingCards.length > 0) {
            const deleteIndices = pendingDeletePricingCards
              .map(({ cardEl }) => parseInt(cardEl.dataset.otherIndex))
              .sort((a, b) => b - a);
            deleteIndices.forEach(i => data.otherServices.cards.splice(i, 1));
          }
          if (pendingNewPricingCards.length > 0) {
            const startIndex = data.otherServices.cards.length;
            pendingNewPricingCards.forEach((item, i) => {
              // Read latest draft edits from DOM before committing
              const nameEl = item.cardEl.querySelector('.pricing__other-name');
              const prEl   = item.cardEl.querySelector('.pricing__other-price');
              const dEl    = item.cardEl.querySelector('.pricing__other-desc');
              if (nameEl) item.card.name        = nameEl.textContent.trim();
              if (prEl)   item.card.price       = prEl.textContent.trim();
              if (dEl)    item.card.description = dEl.textContent.trim();
              // Read link text + href from btnChanges (edited via popover)
              const btnEntry = item.btnKey ? btnChanges.get(item.btnKey) : null;
              if (btnEntry) {
                if (btnEntry.labelEl) item.card.linkText = btnEntry.labelEl.textContent.trim();
                item.card.linkHref = btnEntry.linkEl.getAttribute('href') || item.card.linkHref;
              }
              data.otherServices.cards.push(item.card);
              item.finalIndex = startIndex + i;
            });
          }
        }

        // Apply pending deletes and adds to services.json
        if (file === 'data/services.json') {
          if (pendingDeleteCards.length > 0) {
            // Splice in descending index order so earlier indices stay valid
            const deleteIndices = pendingDeleteCards
              .map(({ cardEl }) => parseInt(cardEl.dataset.cardJsonIndex))
              .sort((a, b) => b - a);
            deleteIndices.forEach(i => data.cards.splice(i, 1));
          }
          if (pendingNewCards.length > 0) {
            const startIndex = data.cards.length;
            pendingNewCards.forEach((item, i) => {
              // Read latest draft edits from DOM before committing
              const tEl = item.cardEl.querySelector('.services__card-title');
              const dEl = item.cardEl.querySelector('.services__card-desc');
              if (tEl) item.card.title       = tEl.textContent.trim();
              if (dEl) item.card.description = dEl.textContent.trim();
              data.cards.push(item.card);
              item.finalIndex = startIndex + i;
            });
          }
        }

        commits.push(SCV_ADMIN.commitJSON(file, data,
          `Admin: update ${file.replace('data/', '').replace('.json', '')} [${changes.length} field${changes.length === 1 ? '' : 's'}]`
        ));
      }
      await Promise.all(commits);

      // Remove deleted service cards from DOM and re-index remaining ones
      if (pendingDeleteCards.length > 0) {
        const deleteIndices = pendingDeleteCards
          .map(({ cardEl }) => parseInt(cardEl.dataset.cardJsonIndex))
          .sort((a, b) => b - a); // descending so re-index stays consistent
        deleteIndices.forEach(deletedIndex => {
          // Remove the card element
          const item = pendingDeleteCards.find(p => parseInt(p.cardEl.dataset.cardJsonIndex) === deletedIndex);
          if (item) item.cardEl.remove();

          // Re-key editables for cards that shifted down
          const toUpdate = [];
          editables.forEach((entry, key) => {
            if (entry.file !== 'data/services.json') return;
            const match = entry.path.match(/^cards\[(\d+)\]/);
            if (!match) return;
            const i = parseInt(match[1]);
            if (i === deletedIndex) {
              toUpdate.push({ key, action: 'delete' });
            } else if (i > deletedIndex) {
              const newIdx = i - 1;
              const newPath = entry.path.replace(/^cards\[\d+\]/, `cards[${newIdx}]`);
              toUpdate.push({ key, action: 'rekey', newKey: `data/services.json|${newPath}`, newPath });
            }
          });
          toUpdate.forEach(({ key, action, newKey, newPath }) => {
            if (action === 'delete') {
              editables.delete(key);
            } else {
              const entry = editables.get(key);
              editables.delete(key);
              entry.path = newPath;
              editables.set(newKey, entry);
            }
          });

          // Update data-card-json-index on remaining DOM cards
          document.querySelectorAll('[data-card-json-index]').forEach(el => {
            const i = parseInt(el.dataset.cardJsonIndex);
            if (i > deletedIndex) el.dataset.cardJsonIndex = i - 1;
          });
        });
        pendingDeleteCards.length = 0;
      }

      // Wire up newly published service cards
      pendingNewCards.forEach(({ wire, finalIndex }) => wire(finalIndex));
      pendingNewCards.length = 0;

      // Remove deleted pricing cards from DOM and re-index remaining ones
      if (pendingDeletePricingCards.length > 0) {
        const deleteIndices = pendingDeletePricingCards
          .map(({ cardEl }) => parseInt(cardEl.dataset.otherIndex))
          .sort((a, b) => b - a);
        deleteIndices.forEach(deletedIndex => {
          const item = pendingDeletePricingCards.find(p => parseInt(p.cardEl.dataset.otherIndex) === deletedIndex);
          if (item) item.cardEl.remove();

          const toUpdate = [];
          editables.forEach((entry, key) => {
            if (entry.file !== 'data/pricing.json') return;
            const match = entry.path.match(/^otherServices\.cards\[(\d+)\]/);
            if (!match) return;
            const i = parseInt(match[1]);
            if (i === deletedIndex) {
              toUpdate.push({ key, action: 'delete' });
            } else if (i > deletedIndex) {
              const newIdx = i - 1;
              const newPath = entry.path.replace(/^otherServices\.cards\[\d+\]/, `otherServices.cards[${newIdx}]`);
              toUpdate.push({ key, action: 'rekey', newKey: `data/pricing.json|${newPath}`, newPath });
            }
          });
          toUpdate.forEach(({ key, action, newKey, newPath }) => {
            if (action === 'delete') {
              editables.delete(key);
            } else {
              const entry = editables.get(key);
              editables.delete(key);
              entry.path = newPath;
              editables.set(newKey, entry);
            }
          });

          document.querySelectorAll('[data-other-index]').forEach(el => {
            const i = parseInt(el.dataset.otherIndex);
            if (i > deletedIndex) el.dataset.otherIndex = i - 1;
          });
        });
        pendingDeletePricingCards.length = 0;
      }

      // Wire up newly published pricing cards
      pendingNewPricingCards.forEach(({ wire, finalIndex }) => wire(finalIndex));
      pendingNewPricingCards.length = 0;

      // Wire up newly published team members
      pendingNewTeamMembers.forEach(({ wire, finalIndex }) => wire(finalIndex));
      pendingNewTeamMembers.length = 0;

      // Wire up newly published testimonials
      pendingNewTestimonials.forEach(({ wire, finalIndex }) => wire(finalIndex));
      pendingNewTestimonials.length = 0;

      // Finalize newly published partner logos (assign real index)
      if (pendingNewPartners.length > 0) {
        const grid = document.getElementById('trust-admin-grid');
        const existing = grid ? grid.querySelectorAll('[data-partner-index]').length : 0;
        pendingNewPartners.forEach(({ itemEl }, i) => {
          itemEl.dataset.partnerIndex = existing + i;
          itemEl.classList.remove('trust__admin-item--pending');
        });
        pendingNewPartners.length = 0;
      }

      // Remove deleted partner logos and re-index remaining
      if (pendingDeletePartners.length > 0) {
        const deleteIndices = pendingDeletePartners
          .map(({ itemEl }) => parseInt(itemEl.dataset.partnerIndex))
          .sort((a, b) => b - a);
        deleteIndices.forEach(deletedIndex => {
          const item = pendingDeletePartners.find(p => parseInt(p.itemEl.dataset.partnerIndex) === deletedIndex);
          if (item) item.itemEl.remove();
          document.querySelectorAll('[data-partner-index]').forEach(el => {
            const i = parseInt(el.dataset.partnerIndex);
            if (i > deletedIndex) el.dataset.partnerIndex = i - 1;
          });
        });
        pendingDeletePartners.length = 0;
      }

      // Remove deleted team members and re-index remaining
      if (pendingDeleteTeamMembers.length > 0) {
        const deleteIndices = pendingDeleteTeamMembers
          .map(({ cardEl }) => parseInt(cardEl.dataset.teamIndex))
          .sort((a, b) => b - a);
        deleteIndices.forEach(deletedIndex => {
          const item = pendingDeleteTeamMembers.find(p => parseInt(p.cardEl.dataset.teamIndex) === deletedIndex);
          if (item) item.cardEl.remove();

          // Re-key editables Map for team.json paths like [i].name
          const toUpdate = [];
          editables.forEach((entry, key) => {
            if (entry.file !== 'data/team.json') return;
            const match = entry.path.match(/^\[(\d+)\]/);
            if (!match) return;
            const i = parseInt(match[1]);
            if (i === deletedIndex) toUpdate.push({ key, action: 'delete' });
            else if (i > deletedIndex) {
              const newIdx = i - 1;
              const newPath = entry.path.replace(/^\[\d+\]/, `[${newIdx}]`);
              toUpdate.push({ key, action: 'rekey', newKey: `data/team.json|${newPath}`, newPath });
            }
          });
          toUpdate.forEach(({ key, action, newKey, newPath }) => {
            if (action === 'delete') { editables.delete(key); }
            else {
              const entry = editables.get(key);
              editables.delete(key);
              entry.path = newPath;
              editables.set(newKey, entry);
            }
          });

          // Re-key btnChanges for LinkedIn URLs
          const btnToUpdate = [];
          btnChanges.forEach((entry, key) => {
            if (entry.file !== 'data/team.json') return;
            const match = entry.hrefPath ? entry.hrefPath.match(/^\[(\d+)\]/) : null;
            if (!match) return;
            const i = parseInt(match[1]);
            if (i === deletedIndex) btnToUpdate.push({ key, action: 'delete' });
            else if (i > deletedIndex) {
              const newIdx = i - 1;
              const newHrefPath = entry.hrefPath.replace(/^\[\d+\]/, `[${newIdx}]`);
              btnToUpdate.push({ key, action: 'rekey', newKey: `data/team.json|${newHrefPath}`, newHrefPath });
            }
          });
          btnToUpdate.forEach(({ key, action, newKey, newHrefPath }) => {
            if (action === 'delete') { btnChanges.delete(key); }
            else {
              const entry = btnChanges.get(key);
              btnChanges.delete(key);
              entry.hrefPath = newHrefPath;
              btnChanges.set(newKey, entry);
            }
          });

          document.querySelectorAll('[data-team-index]').forEach(el => {
            const i = parseInt(el.dataset.teamIndex);
            if (i > deletedIndex) el.dataset.teamIndex = i - 1;
          });
        });
        pendingDeleteTeamMembers.length = 0;
      }

      // Remove deleted testimonials and re-index remaining
      if (pendingDeleteTestimonials.length > 0) {
        const deleteIndices = pendingDeleteTestimonials
          .map(({ cardEl }) => parseInt(cardEl.dataset.testiIndex))
          .sort((a, b) => b - a);
        deleteIndices.forEach(deletedIndex => {
          const item = pendingDeleteTestimonials.find(p => parseInt(p.cardEl.dataset.testiIndex) === deletedIndex);
          if (item) item.cardEl.remove();

          // Re-key editables Map for testimonials.json paths like [i].quote
          const toUpdate = [];
          editables.forEach((entry, key) => {
            if (entry.file !== 'data/testimonials.json') return;
            const match = entry.path.match(/^\[(\d+)\]/);
            if (!match) return;
            const i = parseInt(match[1]);
            if (i === deletedIndex) toUpdate.push({ key, action: 'delete' });
            else if (i > deletedIndex) {
              const newIdx = i - 1;
              const newPath = entry.path.replace(/^\[\d+\]/, `[${newIdx}]`);
              toUpdate.push({ key, action: 'rekey', newKey: `data/testimonials.json|${newPath}`, newPath });
            }
          });
          toUpdate.forEach(({ key, action, newKey, newPath }) => {
            if (action === 'delete') { editables.delete(key); }
            else {
              const entry = editables.get(key);
              editables.delete(key);
              entry.path = newPath;
              editables.set(newKey, entry);
            }
          });

          document.querySelectorAll('[data-testi-index]').forEach(el => {
            const i = parseInt(el.dataset.testiIndex);
            if (i > deletedIndex) el.dataset.testiIndex = i - 1;
          });
        });
        pendingDeleteTestimonials.length = 0;
      }

      // Reset "original" to the committed values
      editables.forEach(entry => {
        if (entry.el.textContent !== entry.original) {
          entry.original = entry.el.textContent;
          entry.el.setAttribute('data-original', entry.original);
          entry.el.classList.remove('is-changed');
        }
      });
      btnChanges.forEach(entry => {
        entry.origText = entry.labelEl ? entry.labelEl.textContent.trim() : entry.origText;
        entry.origHref = entry.linkEl.getAttribute('href');
      });

      updateToolbar();
      btnPublish.textContent = '↑ Publish Changes';
      showToast('success', `Published ${fileChanges.size} file${fileChanges.size === 1 ? '' : 's'} to GitHub — live in < 1 min.`);

    } catch (err) {
      console.error('[SCV Admin] Publish failed:', err);
      btnDiscard.disabled = false;
      btnPublish.disabled = false;
      btnPublish.textContent = '↑ Publish Changes';
      showToast('error', `Publish failed: ${err.message}`);
    }
  });

  // ── Service admin: add card ───────────────────────────────────────────────
  // NOTE: Spotlight feature is commented out below — restore when ready.

  function setupServiceAdmin() {
    const grid = document.querySelector('.services__grid');
    if (!grid) return;

    const icons = window._scvServiceIcons || {};

    function slugify(str) {
      return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    /* ── SPOTLIGHT (commented out) ────────────────────────────────────────

    const starSvg = `...`;

    async function applySpotlight(cardId, title, description, triggerBtn) { ... }

    function setupSpotlightModal() { ... }

    function attachStarBtn(cardEl, cardId, getTitle, getDesc) { ... }

    document.querySelectorAll('[data-card-json-index]').forEach(cardEl => {
      attachStarBtn(...);
    });

    ─────────────────────────────────────────────────────────────────────── */

    // ── Delete service card ───────────────────────────────────────────────

    const delModal = document.createElement('div');
    delModal.className = 'svc-modal-bg';
    delModal.innerHTML =
      `<div class="svc-modal-panel" style="max-width:400px">` +
        `<div class="pm-h">Delete this service?</div>` +
        `<p class="pm-sub" id="svc-del-msg"></p>` +
        `<p style="font-size:12px;color:#555;line-height:1.5;">The card will be removed when you click Publish. Use Discard to cancel.</p>` +
        `<div class="pm-actions">` +
          `<button class="pm-btn-cancel" id="svc-del-cancel">Cancel</button>` +
          `<button id="svc-del-confirm" style="padding:10px 20px;border-radius:8px;font-family:\'Inter\',sans-serif;font-size:14px;font-weight:700;cursor:pointer;border:none;background:#e05a5a;color:#fff;transition:background 0.15s;">Delete Service</button>` +
        `</div>` +
      `</div>`;
    document.body.appendChild(delModal);

    let delCallback = null;
    const delMsg     = document.getElementById('svc-del-msg');
    const delConfirm = document.getElementById('svc-del-confirm');
    const delCancel  = document.getElementById('svc-del-cancel');

    function openDelModal(title, onConfirm) {
      delMsg.textContent = `"${title}" will be removed from the services section.`;
      delCallback = onConfirm;
      delConfirm.textContent = 'Delete Service';
      delConfirm.disabled = false;
      delModal.classList.add('open');
      delConfirm.focus();
    }

    function closeDelModal() { delModal.classList.remove('open'); delCallback = null; }

    delCancel.addEventListener('click', closeDelModal);
    delModal.addEventListener('click', e => { if (e.target === delModal) closeDelModal(); });
    delConfirm.addEventListener('click', () => {
      if (!delCallback) return;
      delCallback();
      closeDelModal();
    });

    // attachDelBtn queues deletion for the Publish/Discard flow
    function attachDelBtn(cardEl) {
      const titleEl = cardEl.querySelector('.services__card-title');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'svc-del-btn';
      btn.setAttribute('aria-label', 'Delete service card');
      btn.title = 'Delete service';
      btn.textContent = '×';
      cardEl.appendChild(btn);

      btn.addEventListener('click', e => {
        e.stopPropagation();
        const title = titleEl ? titleEl.textContent.trim() : 'this service';
        openDelModal(title, () => {
          cardEl.classList.add('services__card--pending-delete');
          pendingDeleteCards.push({ cardEl });
          updateToolbar();
          showToast('success', `"${title}" queued for deletion — hit Publish to confirm.`);
        });
      });
    }

    // Attach delete buttons to all existing cards
    document.querySelectorAll('[data-card-json-index]').forEach(cardEl => {
      attachDelBtn(cardEl);
    });

    // ── Add Service ───────────────────────────────────────────────────────

    const addCard = document.createElement('div');
    addCard.className = 'services__card services__card--add';
    addCard.setAttribute('role', 'button');
    addCard.setAttribute('tabindex', '0');
    addCard.innerHTML =
      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">` +
      `<path d="M12 5v14M5 12h14"/></svg>` +
      `<span>Add Service</span>`;
    addCard.addEventListener('click', openAddServiceModal);
    addCard.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openAddServiceModal(); });
    grid.appendChild(addCard);

    // ── Add Service modal ─────────────────────────────────────────────────

    const ICON_OPTIONS = [
      { value: 'real-estate',  label: 'Real Estate' },
      { value: 'branding',     label: 'Branding' },
      { value: 'wedding',      label: 'Wedding' },
      { value: 'aerial',       label: 'Aerial / Drone' },
      { value: 'corporate',    label: 'Corporate' },
      { value: 'social-media', label: 'Social Media' },
    ];

    const addModalBg = document.createElement('div');
    addModalBg.className = 'svc-modal-bg';
    addModalBg.innerHTML =
      `<div class="svc-modal-panel">` +
        `<div class="pm-h">Add Service</div>` +
        `<p class="pm-sub">The new card will be staged in the grid. Click <strong style="color:#c9a84c">Publish Changes</strong> to make it live.</p>` +
        `<div class="pm-field">` +
          `<label class="pm-lbl" for="svc-title-in">Title</label>` +
          `<input type="text" id="svc-title-in" class="pm-in" placeholder="e.g. Event Photography" />` +
        `</div>` +
        `<div class="pm-field">` +
          `<label class="pm-lbl" for="svc-desc-in">Description</label>` +
          `<textarea id="svc-desc-in" class="pm-ta" rows="3" placeholder="Brief description of the service…"></textarea>` +
        `</div>` +
        `<div class="pm-field">` +
          `<label class="pm-lbl" for="svc-icon-sel">Icon</label>` +
          `<select id="svc-icon-sel" class="pm-sel">` +
            ICON_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('') +
          `</select>` +
        `</div>` +
        `<div class="pm-actions">` +
          `<button class="pm-btn-cancel" id="svc-modal-cancel">Cancel</button>` +
          `<button class="pm-btn-primary" id="svc-modal-submit" disabled>Add Service</button>` +
        `</div>` +
      `</div>`;
    document.body.appendChild(addModalBg);

    const titleIn   = document.getElementById('svc-title-in');
    const descIn    = document.getElementById('svc-desc-in');
    const iconSel   = document.getElementById('svc-icon-sel');
    const submitBtn = document.getElementById('svc-modal-submit');

    titleIn.addEventListener('input', () => { submitBtn.disabled = !titleIn.value.trim(); });

    function openAddServiceModal() {
      titleIn.value = ''; descIn.value = ''; iconSel.value = 'branding';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Add Service';
      addModalBg.classList.add('open');
      setTimeout(() => titleIn.focus(), 60);
    }

    function closeAddServiceModal() { addModalBg.classList.remove('open'); }

    document.getElementById('svc-modal-cancel').addEventListener('click', closeAddServiceModal);
    addModalBg.addEventListener('click', e => { if (e.target === addModalBg) closeAddServiceModal(); });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (delModal.classList.contains('open'))    { closeDelModal();        return; }
      if (addModalBg.classList.contains('open'))  { closeAddServiceModal(); return; }
    });

    submitBtn.addEventListener('click', () => {
      const title  = titleIn.value.trim();
      const desc   = descIn.value.trim();
      const iconId = iconSel.value;
      if (!title) return;

      const newCard = { id: iconId || slugify(title), title, description: desc, visible: true };

      // Render card in DOM immediately (pending, no index yet)
      const cardEl = document.createElement('div');
      cardEl.className = 'services__card services__card--pending';
      cardEl.innerHTML =
        `<div class="services__card-icon">` +
          `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">${icons[newCard.id] || ''}</svg>` +
        `</div>` +
        `<h3 class="services__card-title">${title}</h3>` +
        `<p class="services__card-desc">${desc || ''}</p>`;
      grid.insertBefore(cardEl, addCard);

      // Make fields editable immediately so the admin can tweak before publishing
      const draftTitleEl = cardEl.querySelector('.services__card-title');
      const draftDescEl  = cardEl.querySelector('.services__card-desc');
      if (draftTitleEl) makeEditableDraft(draftTitleEl);
      if (draftDescEl)  makeEditableDraft(draftDescEl);

      // Queue for publish — wire() is called after successful publish with the real index
      pendingNewCards.push({
        card: newCard,
        cardEl,
        wire(finalIndex) {
          cardEl.dataset.cardJsonIndex = finalIndex;
          cardEl.classList.remove('services__card--pending');
          const tEl = cardEl.querySelector('.services__card-title');
          const dEl = cardEl.querySelector('.services__card-desc');
          if (tEl) markEditable(tEl, 'data/services.json', `cards[${finalIndex}].title`);
          if (dEl) markEditable(dEl, 'data/services.json', `cards[${finalIndex}].description`);
          attachDelBtn(cardEl);
        },
      });

      closeAddServiceModal();
      updateToolbar();
      showToast('success', `"${title}" staged — hit Publish to go live.`);
    });
  }

  // ── Pricing admin: add + delete cards ────────────────────────────────────

  function setupPricingAdmin() {
    const grid = document.getElementById('pricing-other-grid');
    if (!grid) return;

    // ── Delete modal ─────────────────────────────────────────────────────

    const pricingDelModal = document.createElement('div');
    pricingDelModal.className = 'svc-modal-bg';
    pricingDelModal.innerHTML =
      `<div class="svc-modal-panel" style="max-width:400px">` +
        `<div class="pm-h">Delete this pricing card?</div>` +
        `<p class="pm-sub" id="pricing-del-msg"></p>` +
        `<p style="font-size:12px;color:#555;line-height:1.5;">The card will be removed when you click Publish. Use Discard to cancel.</p>` +
        `<div class="pm-actions">` +
          `<button class="pm-btn-cancel" id="pricing-del-cancel">Cancel</button>` +
          `<button id="pricing-del-confirm" style="padding:10px 20px;border-radius:8px;font-family:'Inter',sans-serif;font-size:14px;font-weight:700;cursor:pointer;border:none;background:#e05a5a;color:#fff;">Delete Card</button>` +
        `</div>` +
      `</div>`;
    document.body.appendChild(pricingDelModal);

    let pricingDelCallback = null;
    const pricingDelMsg     = document.getElementById('pricing-del-msg');
    const pricingDelConfirm = document.getElementById('pricing-del-confirm');
    const pricingDelCancel  = document.getElementById('pricing-del-cancel');

    function openPricingDelModal(title, onConfirm) {
      pricingDelMsg.textContent = `"${title}" will be removed from the pricing section.`;
      pricingDelCallback = onConfirm;
      pricingDelModal.classList.add('open');
      pricingDelConfirm.focus();
    }
    function closePricingDelModal() { pricingDelModal.classList.remove('open'); pricingDelCallback = null; }

    pricingDelCancel.addEventListener('click', closePricingDelModal);
    pricingDelModal.addEventListener('click', e => { if (e.target === pricingDelModal) closePricingDelModal(); });
    pricingDelConfirm.addEventListener('click', () => {
      if (!pricingDelCallback) return;
      pricingDelCallback();
      closePricingDelModal();
    });

    function attachPricingDelBtn(cardEl) {
      const nameEl = cardEl.querySelector('.pricing__other-name');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'svc-del-btn';
      btn.setAttribute('aria-label', 'Delete pricing card');
      btn.title = 'Delete card';
      btn.textContent = '×';
      cardEl.appendChild(btn);

      btn.addEventListener('click', e => {
        e.stopPropagation();
        const title = nameEl ? nameEl.textContent.trim() : 'this card';
        openPricingDelModal(title, () => {
          cardEl.classList.add('services__card--pending-delete');
          pendingDeletePricingCards.push({ cardEl });
          updateToolbar();
          showToast('success', `"${title}" queued for deletion — hit Publish to confirm.`);
        });
      });
    }

    // Attach delete buttons to all existing pricing cards
    document.querySelectorAll('[data-other-index]').forEach(cardEl => attachPricingDelBtn(cardEl));

    // ── Add Pricing Card placeholder ──────────────────────────────────────

    const addCard = document.createElement('div');
    addCard.className = 'pricing__other-card pricing__other-card--add';
    addCard.setAttribute('role', 'button');
    addCard.setAttribute('tabindex', '0');
    addCard.style.cssText =
      'border:2px dashed #2a2a2a !important; background:transparent !important;' +
      'display:flex; flex-direction:column; align-items:center; justify-content:center;' +
      'gap:8px; color:#444; cursor:pointer; min-height:120px;' +
      'transition:border-color 0.15s, color 0.15s;';
    addCard.innerHTML =
      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>` +
      `<span style="font-size:13px;font-weight:600;font-family:'Inter',sans-serif;">Add Pricing Card</span>`;
    addCard.addEventListener('mouseenter', () => { addCard.style.borderColor = '#c9a84c'; addCard.style.color = '#c9a84c'; });
    addCard.addEventListener('mouseleave', () => { addCard.style.borderColor = '#2a2a2a'; addCard.style.color = '#444'; });
    addCard.addEventListener('click', openAddPricingModal);
    addCard.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openAddPricingModal(); });
    grid.appendChild(addCard);

    // ── Add Pricing Card modal ────────────────────────────────────────────

    const modalBg = document.createElement('div');
    modalBg.className = 'svc-modal-bg';
    modalBg.innerHTML =
      `<div class="svc-modal-panel">` +
        `<div class="pm-h">Add Pricing Card</div>` +
        `<p class="pm-sub">The new card will be staged in the grid. Click <strong style="color:#c9a84c">Publish Changes</strong> to make it live.</p>` +
        `<div class="pm-field">` +
          `<label class="pm-lbl" for="pc-name-in">Service Name</label>` +
          `<input type="text" id="pc-name-in" class="pm-in" placeholder="e.g. Event Photography" />` +
        `</div>` +
        `<div class="pm-field">` +
          `<label class="pm-lbl" for="pc-price-in">Price</label>` +
          `<input type="text" id="pc-price-in" class="pm-in" placeholder='e.g. From $250 or "Get a Quote Today"' />` +
        `</div>` +
        `<div class="pm-field">` +
          `<label class="pm-lbl" for="pc-desc-in">Description</label>` +
          `<textarea id="pc-desc-in" class="pm-ta" rows="2" placeholder="Brief description…"></textarea>` +
        `</div>` +
        `<div class="pm-field">` +
          `<label class="pm-lbl" for="pc-link-text-in">Link Text</label>` +
          `<input type="text" id="pc-link-text-in" class="pm-in" placeholder='e.g. "Book →" or "Contact Us →"' />` +
        `</div>` +
        `<div class="pm-field">` +
          `<label class="pm-lbl" for="pc-link-href-in">Link URL</label>` +
          `<input type="text" id="pc-link-href-in" class="pm-in" placeholder="https://… or index.html#contact" />` +
        `</div>` +
        `<div class="pm-actions">` +
          `<button class="pm-btn-cancel" id="pc-modal-cancel">Cancel</button>` +
          `<button class="pm-btn-primary" id="pc-modal-submit" disabled>Add Card</button>` +
        `</div>` +
      `</div>`;
    document.body.appendChild(modalBg);

    const nameIn     = document.getElementById('pc-name-in');
    const priceIn    = document.getElementById('pc-price-in');
    const descIn     = document.getElementById('pc-desc-in');
    const linkTextIn = document.getElementById('pc-link-text-in');
    const linkHrefIn = document.getElementById('pc-link-href-in');
    const submitBtn  = document.getElementById('pc-modal-submit');

    nameIn.addEventListener('input', () => { submitBtn.disabled = !nameIn.value.trim(); });

    function openAddPricingModal() {
      nameIn.value = ''; priceIn.value = ''; descIn.value = '';
      linkTextIn.value = 'Book →'; linkHrefIn.value = '';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Add Card';
      modalBg.classList.add('open');
      setTimeout(() => nameIn.focus(), 60);
    }

    function closeAddPricingModal() { modalBg.classList.remove('open'); }

    document.getElementById('pc-modal-cancel').addEventListener('click', closeAddPricingModal);
    modalBg.addEventListener('click', e => { if (e.target === modalBg) closeAddPricingModal(); });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (pricingDelModal.classList.contains('open')) { closePricingDelModal(); return; }
      if (modalBg.classList.contains('open'))         { closeAddPricingModal(); return; }
    });

    submitBtn.addEventListener('click', () => {
      const name     = nameIn.value.trim();
      const price    = priceIn.value.trim();
      const desc     = descIn.value.trim();
      const linkText = linkTextIn.value.trim() || 'Book →';
      const linkHref = linkHrefIn.value.trim() || '#contact';
      if (!name) return;

      const newCard = { name, price, description: desc, linkText, linkHref };

      // Render card in DOM (pending, no data-other-index yet)
      const cardEl = document.createElement('div');
      cardEl.className = 'pricing__other-card';
      const external = linkHref.startsWith('http');
      cardEl.innerHTML =
        `<div class="pricing__other-name">${name}</div>` +
        `<div class="pricing__other-price">${price}</div>` +
        `<div class="pricing__other-desc">${desc}</div>` +
        `<a href="${linkHref}"${external ? ' target="_blank" rel="noopener"' : ''} class="pricing__other-link">` +
          `<span class="btn-label">${linkText}</span>` +
        `</a>`;
      grid.insertBefore(cardEl, addCard);

      // Make text fields editable immediately so the admin can tweak before publishing
      ['pricing__other-name', 'pricing__other-price', 'pricing__other-desc'].forEach(cls => {
        const el = cardEl.querySelector(`.${cls}`);
        if (el) makeEditableDraft(el);
      });

      // Register the link button with the popover editor right away using a placeholder path.
      // wire() will replace this with the real path after publish.
      const pendingHrefPath = `__pending_${Date.now()}__`;
      const linkEl = cardEl.querySelector('.pricing__other-link');
      if (linkEl && window._scvRegisterBtnEl) {
        linkEl.setAttribute('data-btn-file', 'data/pricing.json');
        linkEl.setAttribute('data-btn-text-path', `otherServices.__pending__.linkText`);
        linkEl.setAttribute('data-btn-href-path', pendingHrefPath);
        window._scvRegisterBtnEl(linkEl);
      }
      const pendingBtnKey = `data/pricing.json|${pendingHrefPath}`;

      // Queue for Publish — wire() is called after successful publish with the real index
      pendingNewPricingCards.push({
        card: newCard,
        cardEl,
        btnKey: pendingBtnKey,
        wire(finalIndex) {
          // Remove the placeholder btnChanges entry and re-register with real paths
          btnChanges.delete(pendingBtnKey);
          cardEl.dataset.otherIndex = finalIndex;
          const nameEl = cardEl.querySelector('.pricing__other-name');
          const prEl   = cardEl.querySelector('.pricing__other-price');
          const dEl    = cardEl.querySelector('.pricing__other-desc');
          const lEl    = cardEl.querySelector('.pricing__other-link');
          if (nameEl) markEditable(nameEl, 'data/pricing.json', `otherServices.cards[${finalIndex}].name`);
          if (prEl)   markEditable(prEl,   'data/pricing.json', `otherServices.cards[${finalIndex}].price`);
          if (dEl)    markEditable(dEl,    'data/pricing.json', `otherServices.cards[${finalIndex}].description`);
          if (lEl && window._scvRegisterBtnEl) {
            lEl.setAttribute('data-btn-text-path', `otherServices.cards[${finalIndex}].linkText`);
            lEl.setAttribute('data-btn-href-path', `otherServices.cards[${finalIndex}].linkHref`);
            window._scvRegisterBtnEl(lEl);
          }
          attachPricingDelBtn(cardEl);
        },
      });

      closeAddPricingModal();
      updateToolbar();
      showToast('success', `"${name}" staged — hit Publish to go live.`);
    });
  }

  // ── Testimonials admin ────────────────────────────────────────────────────

  function setupTestimonialsAdmin() {
    const grid = document.getElementById('testimonials-grid');
    if (!grid) return; // not in admin mode

    // Attach delete buttons to existing testimonial cards
    document.querySelectorAll('[data-testi-index]').forEach(cardEl => attachTestiDelBtn(cardEl));

    // ── Add Testimonial placeholder card ─────────────────────────────────

    const addCard = document.createElement('div');
    addCard.className = 'testimonials__card testimonials__card--add';
    addCard.setAttribute('role', 'button');
    addCard.setAttribute('tabindex', '0');
    addCard.innerHTML =
      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>` +
      `<span>Add Testimonial</span>`;
    addCard.addEventListener('click', openAddTestiModal);
    addCard.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openAddTestiModal(); });
    grid.appendChild(addCard);

    // ── Add Testimonial modal ─────────────────────────────────────────────

    const modalBg = document.createElement('div');
    modalBg.className = 'svc-modal-bg';
    modalBg.innerHTML =
      `<div class="svc-modal-panel">` +
        `<div class="pm-h">Add Testimonial</div>` +
        `<p class="pm-sub">The new card will be staged in the grid. Click <strong style="color:#c9a84c">Publish Changes</strong> to make it live.</p>` +
        `<div class="pm-field">` +
          `<label class="pm-lbl" for="ti-quote-in">Quote <span style="color:#e05a5a">*</span></label>` +
          `<textarea id="ti-quote-in" class="pm-ta" rows="4" placeholder="What did the client say?"></textarea>` +
        `</div>` +
        `<div class="pm-field">` +
          `<label class="pm-lbl" for="ti-name-in">Client Name <span style="color:#e05a5a">*</span></label>` +
          `<input type="text" id="ti-name-in" class="pm-in" placeholder="Full name" />` +
        `</div>` +
        `<div class="pm-field">` +
          `<label class="pm-lbl" for="ti-role-in">Role / Title</label>` +
          `<input type="text" id="ti-role-in" class="pm-in" placeholder="e.g. Real Estate Professional" />` +
        `</div>` +
        `<div class="pm-actions">` +
          `<button class="pm-btn-cancel" id="ti-modal-cancel">Cancel</button>` +
          `<button class="pm-btn-primary" id="ti-modal-submit" disabled>Add Testimonial</button>` +
        `</div>` +
      `</div>`;
    document.body.appendChild(modalBg);

    const quoteIn  = document.getElementById('ti-quote-in');
    const nameIn   = document.getElementById('ti-name-in');
    const roleIn   = document.getElementById('ti-role-in');
    const submitBtn = document.getElementById('ti-modal-submit');

    function checkEnabled() { submitBtn.disabled = !quoteIn.value.trim() || !nameIn.value.trim(); }
    quoteIn.addEventListener('input', checkEnabled);
    nameIn.addEventListener('input', checkEnabled);

    function openAddTestiModal() {
      quoteIn.value = ''; nameIn.value = ''; roleIn.value = '';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Add Testimonial';
      modalBg.classList.add('open');
      setTimeout(() => quoteIn.focus(), 60);
    }
    function closeAddTestiModal() { modalBg.classList.remove('open'); }

    document.getElementById('ti-modal-cancel').addEventListener('click', closeAddTestiModal);
    modalBg.addEventListener('click', e => { if (e.target === modalBg) closeAddTestiModal(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modalBg.classList.contains('open')) closeAddTestiModal();
    });

    submitBtn.addEventListener('click', () => {
      const quote = quoteIn.value.trim();
      const name  = nameIn.value.trim();
      const role  = roleIn.value.trim();
      if (!quote || !name) return;

      // row: assign to whichever row has fewer cards currently
      const existingCards = grid.querySelectorAll('[data-testi-index]');
      const row1Count = [...existingCards].filter(c => {
        const i = parseInt(c.dataset.testiIndex);
        return !isNaN(i) && i % 2 === 0; // rough heuristic
      }).length;
      // Simpler: just count and alternate
      const totalExisting = existingCards.length + pendingNewTestimonials.length;
      const row = totalExisting % 2 === 0 ? 1 : 2;

      const testimonial = { quote, name, role, row };

      const cardEl = document.createElement('div');
      cardEl.className = 'testimonials__card';
      cardEl.innerHTML =
        `<div class="testimonials__stars" aria-label="5 out of 5 stars">★★★★★</div>` +
        `<blockquote class="testimonials__quote">"${quote}"</blockquote>` +
        `<div class="testimonials__author">` +
          `<div class="testimonials__name">${name}</div>` +
          `<div class="testimonials__role">${role}</div>` +
        `</div>`;
      grid.insertBefore(cardEl, addCard);

      // Make text fields editable immediately
      const qEl = cardEl.querySelector('.testimonials__quote');
      const nEl = cardEl.querySelector('.testimonials__name');
      const rEl = cardEl.querySelector('.testimonials__role');
      if (qEl) makeEditableDraft(qEl);
      if (nEl) makeEditableDraft(nEl);
      if (rEl) makeEditableDraft(rEl);

      pendingNewTestimonials.push({
        testimonial,
        cardEl,
        wire(finalIndex) {
          cardEl.dataset.testiIndex = finalIndex;
          const qE = cardEl.querySelector('.testimonials__quote');
          const nE = cardEl.querySelector('.testimonials__name');
          const rE = cardEl.querySelector('.testimonials__role');
          if (qE) markEditable(qE, 'data/testimonials.json', `[${finalIndex}].quote`);
          if (nE) markEditable(nE, 'data/testimonials.json', `[${finalIndex}].name`);
          if (rE) markEditable(rE, 'data/testimonials.json', `[${finalIndex}].role`);
          attachTestiDelBtn(cardEl);
        },
      });

      closeAddTestiModal();
      updateToolbar();
      showToast('success', `Testimonial from "${name}" staged — hit Publish to go live.`);
    });
  }

  // ── Shared delete confirmation modal (partner / team / testimonial) ──────────

  let _sharedDelCallback = null;
  let _sharedDelModal = null;
  let _sharedDelMsg   = null;

  function setupSharedDeleteModal() {
    const modal = document.createElement('div');
    modal.className = 'svc-modal-bg';
    modal.innerHTML =
      `<div class="svc-modal-panel" style="max-width:420px">` +
        `<div class="pm-h">Confirm Delete</div>` +
        `<p id="shared-del-msg" class="pm-sub"></p>` +
        `<div class="pm-actions">` +
          `<button class="pm-btn-cancel" id="shared-del-cancel">Cancel</button>` +
          `<button class="pm-btn-danger" id="shared-del-confirm">Delete</button>` +
        `</div>` +
      `</div>`;
    document.body.appendChild(modal);
    _sharedDelModal = modal;
    _sharedDelMsg   = document.getElementById('shared-del-msg');

    const btnCancel  = document.getElementById('shared-del-cancel');
    const btnConfirm = document.getElementById('shared-del-confirm');

    function closeModal() { modal.classList.remove('open'); _sharedDelCallback = null; }
    btnCancel.addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    btnConfirm.addEventListener('click', () => {
      if (_sharedDelCallback) _sharedDelCallback();
      closeModal();
    });
  }

  function openSharedDelModal(message, onConfirm) {
    _sharedDelMsg.textContent = message;
    _sharedDelCallback = onConfirm;
    _sharedDelModal.classList.add('open');
  }

  function attachPartnerDelBtn(itemEl) {
    const nameEl = itemEl.querySelector('.trust__admin-name');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'svc-del-btn';
    btn.setAttribute('aria-label', 'Delete partner logo');
    btn.title = 'Delete logo';
    btn.textContent = '×';
    itemEl.appendChild(btn);
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const name = nameEl ? nameEl.textContent.trim() : 'this logo';
      openSharedDelModal(`"${name}" will be removed from the partner bar.`, () => {
        itemEl.classList.add('trust__admin-item--pending-delete');
        pendingDeletePartners.push({ itemEl });
        updateToolbar();
        showToast('success', `"${name}" queued for deletion — hit Publish to confirm.`);
      });
    });
  }

  function attachTeamDelBtn(cardEl) {
    const nameEl = cardEl.querySelector('.team__name');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'svc-del-btn';
    btn.setAttribute('aria-label', 'Delete team member');
    btn.title = 'Delete member';
    btn.textContent = '×';
    cardEl.appendChild(btn);
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const name = nameEl ? nameEl.textContent.trim() : 'this member';
      openSharedDelModal(`"${name}" will be removed from the team section.`, () => {
        cardEl.classList.add('team__card--pending-delete');
        pendingDeleteTeamMembers.push({ cardEl });
        updateToolbar();
        showToast('success', `"${name}" queued for deletion — hit Publish to confirm.`);
      });
    });
  }

  function attachTestiDelBtn(cardEl) {
    const nameEl = cardEl.querySelector('.testimonials__name');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'svc-del-btn';
    btn.setAttribute('aria-label', 'Delete testimonial');
    btn.title = 'Delete testimonial';
    btn.textContent = '×';
    cardEl.appendChild(btn);
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const name = nameEl ? nameEl.textContent.trim() : 'this testimonial';
      openSharedDelModal(`The testimonial from "${name}" will be removed.`, () => {
        cardEl.classList.add('testimonials__card--pending-delete');
        pendingDeleteTestimonials.push({ cardEl });
        updateToolbar();
        showToast('success', `Testimonial from "${name}" queued for deletion — hit Publish to confirm.`);
      });
    });
  }

  // ── Partner admin: make logos swappable + add new logo ───────────────────

  function setupPartnerAdmin() {
    // Make each existing logo swappable using its grid item as the wrapper
    document.querySelectorAll('#trust-admin-grid .trust__admin-item[data-partner-index]').forEach(item => {
      const img = item.querySelector('img');
      if (img) makeSwappable(img, item, img.getAttribute('src'));
      attachPartnerDelBtn(item);
    });

    const addBtn = document.getElementById('trust-add-btn');
    if (!addBtn) return;

    // ── Add Logo modal ──
    const modalBg = document.createElement('div');
    modalBg.className = 'svc-modal-bg';
    modalBg.innerHTML =
      `<div class="svc-modal-panel">` +
        `<div class="pm-h">Add Partner Logo</div>` +
        `<div class="pm-field">` +
          `<label class="pm-lbl" for="partner-name-in">Partner Name</label>` +
          `<input type="text" id="partner-name-in" class="pm-in" placeholder="e.g. Compass" />` +
        `</div>` +
        `<div class="pm-field">` +
          `<label class="pm-lbl">Logo Image <span style="color:#e05a5a">*</span></label>` +
          `<div class="team__upload-area" id="partner-upload-area">` +
            `<span>Click to select image</span>` +
          `</div>` +
        `</div>` +
        `<div class="pm-actions">` +
          `<button class="pm-btn-cancel" id="partner-modal-cancel">Cancel</button>` +
          `<button class="pm-btn-primary" id="partner-modal-add" disabled>Add Logo</button>` +
        `</div>` +
      `</div>`;
    document.body.appendChild(modalBg);

    const nameIn     = document.getElementById('partner-name-in');
    const uploadArea = document.getElementById('partner-upload-area');
    const btnCancel  = document.getElementById('partner-modal-cancel');
    const btnAdd     = document.getElementById('partner-modal-add');

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    let selectedFile = null;

    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const f = fileInput.files[0];
      if (!f) return;
      selectedFile = f;
      const url = URL.createObjectURL(f);
      uploadArea.innerHTML = `<img src="${url}" style="max-height:64px;object-fit:contain;" />`;
      if (!nameIn.value.trim()) {
        nameIn.value = f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      }
      btnAdd.disabled = false;
    });

    function openModal() {
      selectedFile = null;
      nameIn.value = '';
      uploadArea.innerHTML = '<span>Click to select image</span>';
      fileInput.value = '';
      btnAdd.disabled = true;
      btnAdd.textContent = 'Add Logo';
      modalBg.classList.add('open');
      setTimeout(() => nameIn.focus(), 60);
    }
    function closeModal() { modalBg.classList.remove('open'); }

    addBtn.addEventListener('click', openModal);
    btnCancel.addEventListener('click', closeModal);
    modalBg.addEventListener('click', e => { if (e.target === modalBg) closeModal(); });

    btnAdd.addEventListener('click', async () => {
      if (!selectedFile) { alert('Please select a logo image.'); return; }
      const name = nameIn.value.trim() || selectedFile.name.replace(/\.[^.]+$/, '');
      const repoPath = `assets/images/partners/${selectedFile.name}`;

      btnAdd.textContent = 'Uploading…';
      btnAdd.disabled = true;
      try {
        await SCV_ADMIN.uploadFile(repoPath, selectedFile, `Admin: add partner logo ${selectedFile.name}`);
      } catch (e) {
        alert('Upload failed: ' + e.message);
        btnAdd.textContent = 'Add Logo';
        btnAdd.disabled = false;
        return;
      }

      closeModal();
      btnAdd.textContent = 'Add Logo';
      btnAdd.disabled = false;

      // Build grid item and insert before add button
      const item = document.createElement('div');
      item.className = 'trust__admin-item trust__admin-item--pending';
      item.innerHTML =
        `<img src="${repoPath}" alt="${name}" class="trust__logo" />` +
        `<span class="trust__admin-name">${name}</span>`;
      addBtn.parentNode.insertBefore(item, addBtn);

      // Make swappable immediately
      const imgEl = item.querySelector('img');
      makeSwappable(imgEl, item, repoPath);

      // Stage for Publish
      pendingNewPartners.push({ partner: { name, src: repoPath, tall: false }, itemEl: item });
      updateToolbar();
      fileInput.value = '';
    });
  }

  // ── Team admin: add member ────────────────────────────────────────────────

  function setupTeamAdmin() {
    const grid = document.getElementById('team-grid');
    if (!grid) return;

    // Attach delete buttons to existing team cards
    document.querySelectorAll('[data-team-index]').forEach(cardEl => attachTeamDelBtn(cardEl));

    // ── Add Team Member placeholder card ─────────────────────────────────

    const addCard = document.createElement('div');
    addCard.className = 'team__card team__card--add';
    addCard.setAttribute('role', 'button');
    addCard.setAttribute('tabindex', '0');
    addCard.style.cssText =
      'border:2px dashed #2a2a2a !important; background:transparent !important;' +
      'display:flex; flex-direction:column; align-items:center; justify-content:center;' +
      'gap:8px; color:#444; cursor:pointer; min-height:220px;' +
      'transition:border-color 0.15s, color 0.15s;';
    addCard.innerHTML =
      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>` +
      `<span style="font-size:13px;font-weight:600;font-family:'Inter',sans-serif;">Add Team Member</span>`;
    addCard.addEventListener('mouseenter', () => { addCard.style.borderColor = '#c9a84c'; addCard.style.color = '#c9a84c'; });
    addCard.addEventListener('mouseleave', () => { addCard.style.borderColor = '#2a2a2a'; addCard.style.color = '#444'; });
    addCard.addEventListener('click', openAddTeamModal);
    addCard.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openAddTeamModal(); });
    grid.appendChild(addCard);

    // ── Add Team Member modal ─────────────────────────────────────────────

    const modalBg = document.createElement('div');
    modalBg.className = 'svc-modal-bg';
    modalBg.innerHTML =
      `<div class="svc-modal-panel">` +
        `<div class="pm-h">Add Team Member</div>` +
        `<p class="pm-sub">Fill in the details below. Photo is uploaded immediately; remaining fields go live when you Publish.</p>` +
        `<div class="pm-field">` +
          `<label class="pm-lbl" for="tm-name-in">Name <span style="color:#e05a5a">*</span></label>` +
          `<input type="text" id="tm-name-in" class="pm-in" placeholder="Full name" />` +
        `</div>` +
        `<div class="pm-field">` +
          `<label class="pm-lbl" for="tm-title-in">Title / Role</label>` +
          `<input type="text" id="tm-title-in" class="pm-in" placeholder="e.g. Creative Director" />` +
        `</div>` +
        `<div class="pm-field">` +
          `<label class="pm-lbl" for="tm-bio-in">Bio</label>` +
          `<textarea id="tm-bio-in" class="pm-ta" rows="4" placeholder="Short biography…"></textarea>` +
        `</div>` +
        `<div class="pm-field">` +
          `<label class="pm-lbl" for="tm-li-in">LinkedIn URL</label>` +
          `<input type="text" id="tm-li-in" class="pm-in" placeholder="https://linkedin.com/in/…" />` +
        `</div>` +
        `<div class="pm-field">` +
          `<label class="pm-lbl" for="tm-photo-in">Photo <span style="color:#e05a5a">*</span></label>` +
          `<input type="file" id="tm-photo-in" accept="image/*" style="width:100%;color:#888;font-family:'Inter',sans-serif;font-size:13px;" />` +
          `<div id="tm-photo-preview" style="margin-top:8px;display:none;">` +
            `<img id="tm-photo-img" style="width:80px;height:80px;object-fit:cover;border-radius:50%;border:2px solid #2a2a2a;" />` +
          `</div>` +
        `</div>` +
        `<div class="pm-actions">` +
          `<button class="pm-btn-cancel" id="tm-modal-cancel">Cancel</button>` +
          `<button class="pm-btn-primary" id="tm-modal-submit" disabled>Add Member</button>` +
        `</div>` +
      `</div>`;
    document.body.appendChild(modalBg);

    const nameIn    = document.getElementById('tm-name-in');
    const titleIn   = document.getElementById('tm-title-in');
    const bioIn     = document.getElementById('tm-bio-in');
    const liIn      = document.getElementById('tm-li-in');
    const photoIn   = document.getElementById('tm-photo-in');
    const photoPreview = document.getElementById('tm-photo-preview');
    const photoImg  = document.getElementById('tm-photo-img');
    const submitBtn = document.getElementById('tm-modal-submit');

    function checkSubmitEnabled() {
      submitBtn.disabled = !nameIn.value.trim() || !photoIn.files.length;
    }
    nameIn.addEventListener('input', checkSubmitEnabled);
    photoIn.addEventListener('change', () => {
      const file = photoIn.files[0];
      if (file) {
        photoImg.src = URL.createObjectURL(file);
        photoPreview.style.display = 'block';
      } else {
        photoPreview.style.display = 'none';
      }
      checkSubmitEnabled();
    });

    function openAddTeamModal() {
      nameIn.value = ''; titleIn.value = ''; bioIn.value = ''; liIn.value = '';
      photoIn.value = ''; photoPreview.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Add Member';
      modalBg.classList.add('open');
      setTimeout(() => nameIn.focus(), 60);
    }
    function closeAddTeamModal() { modalBg.classList.remove('open'); }

    document.getElementById('tm-modal-cancel').addEventListener('click', closeAddTeamModal);
    modalBg.addEventListener('click', e => { if (e.target === modalBg) closeAddTeamModal(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modalBg.classList.contains('open')) closeAddTeamModal();
    });

    submitBtn.addEventListener('click', async () => {
      const name    = nameIn.value.trim();
      const title   = titleIn.value.trim();
      const bio     = bioIn.value.trim();
      const linkedin = liIn.value.trim() || '#';
      const photoFile = photoIn.files[0];
      if (!name || !photoFile) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Uploading photo…';

      // Upload photo immediately (binary — can't batch with JSON commit)
      let photoPath = '';
      try {
        const ext = photoFile.name.split('.').pop();
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        photoPath = `assets/images/team/${slug}.${ext}`;
        await SCV_ADMIN.uploadFile(photoPath, photoFile, `Admin: add team photo — ${name}`);
      } catch (err) {
        showToast('error', `Photo upload failed: ${err.message}`);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Member';
        return;
      }

      const member = { name, title, bio, linkedin, photo: photoPath };

      // Render card in DOM (pending, no data-team-index yet)
      const cardEl = document.createElement('div');
      cardEl.className = 'team__card';
      cardEl.innerHTML =
        `<div class="team__photo-wrap">` +
          `<img src="${photoPath}" alt="${name}" class="team__photo" />` +
        `</div>` +
        `<div class="team__info">` +
          `<h3 class="team__name">${name}</h3>` +
          `<div class="team__title">${title}</div>` +
          `<p class="team__bio">${bio}</p>` +
          `<a href="${linkedin}" target="_blank" rel="noopener" class="team__linkedin" aria-label="${name} on LinkedIn">` +
            `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>` +
            ` LinkedIn` +
          `</a>` +
        `</div>`;
      grid.insertBefore(cardEl, addCard);

      // Make text fields editable immediately
      ['team__name', 'team__title', 'team__bio'].forEach(cls => {
        const el = cardEl.querySelector(`.${cls}`);
        if (el) makeEditableDraft(el);
      });

      // Register LinkedIn button with placeholder path so popover + shift+click work now
      const pendingHrefPath = `__pending_team_${Date.now()}__`;
      const linkedInEl = cardEl.querySelector('.team__linkedin');
      if (linkedInEl && window._scvRegisterBtnEl) {
        linkedInEl.setAttribute('data-btn-file', 'data/team.json');
        linkedInEl.setAttribute('data-btn-href-path', pendingHrefPath);
        window._scvRegisterBtnEl(linkedInEl);
      }
      const pendingBtnKey = `data/team.json|${pendingHrefPath}`;

      // Make photo swappable immediately (like existing team photos)
      const imgEl = cardEl.querySelector('.team__photo');
      const wrapEl = cardEl.querySelector('.team__photo-wrap');
      if (imgEl && wrapEl) makeSwappable(imgEl, wrapEl, photoPath);

      // Queue for Publish
      pendingNewTeamMembers.push({
        member,
        cardEl,
        btnKey: pendingBtnKey,
        wire(finalIndex) {
          btnChanges.delete(pendingBtnKey);
          cardEl.dataset.teamIndex = finalIndex;
          const nEl  = cardEl.querySelector('.team__name');
          const tEl  = cardEl.querySelector('.team__title');
          const bEl  = cardEl.querySelector('.team__bio');
          const lEl  = cardEl.querySelector('.team__linkedin');
          if (nEl) markEditable(nEl, 'data/team.json', `[${finalIndex}].name`);
          if (tEl) markEditable(tEl, 'data/team.json', `[${finalIndex}].title`);
          if (bEl) markEditable(bEl, 'data/team.json', `[${finalIndex}].bio`);
          if (lEl && window._scvRegisterBtnEl) {
            lEl.setAttribute('data-btn-href-path', `[${finalIndex}].linkedin`);
            window._scvRegisterBtnEl(lEl);
          }
          attachTeamDelBtn(cardEl);
        },
      });

      closeAddTeamModal();
      updateToolbar();
      showToast('success', `"${name}" staged — hit Publish to go live.`);
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  // ── Preserve admin mode on internal nav links ─────────────────────────────
  // Rewrites links to portfolio.html → portfolio.html?mode=admin so the admin
  // session carries over. Skips CTA buttons (handled via Shift+click below).

  function preserveAdminLinks() {
    document.querySelectorAll('a[href="portfolio.html"]:not([data-btn-file])').forEach(a => {
      a.href = 'portfolio.html?mode=admin';
    });
  }

  function init() {
    setupEditables();
    setupImageSwap();
    setupButtonEditing();
    setupSharedDeleteModal();
    setupServiceAdmin();
    setupPricingAdmin();
    setupTeamAdmin();
    setupTestimonialsAdmin();
    setupPartnerAdmin();
    preserveAdminLinks();
    updateToolbar();
    console.log(`[SCV Admin] Ready — ${editables.size} text fields, ${btnChanges.size} buttons.`);
  }

  if (window._scvReady) init();
  else document.addEventListener('scv:ready', init, { once: true });

})();
