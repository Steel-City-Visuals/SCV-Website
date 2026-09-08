// ── Marketing campaign landing page ──

// Root-absolute — campaign pages can be served from a nested path (e.g. /triplepackage/),
// so a relative 'campaigns/campaigns.json' would resolve against the wrong directory.
const CAMPAIGNS_URL        = '/campaigns/campaigns.json';
const GITHUB_CAMPAIGNS_URL = `https://api.github.com/repos/Steel-City-Visuals/SCV-Website/contents/campaigns/campaigns.json?ref=main&t=${Date.now()}`;

// Same reasoning as CAMPAIGNS_URL above — normalize stored asset paths to root-absolute.
function toRootPath(path) {
  if (!path) return path;
  if (/^https?:\/\//.test(path)) return path;
  return path.startsWith('/') ? path : '/' + path;
}

function toAbsoluteURL(path) {
  if (!path) return path;
  if (/^https?:\/\//.test(path)) return path;
  return window.location.origin + toRootPath(path);
}

// Resolve slug from ?slug= (used for local testing / previews) or, failing that,
// from the URL path — e.g. /triplepackage/ or /triplepackage/index.html, which is
// how the admin-generated per-campaign pages are served.
function getSlug() {
  const qs = new URLSearchParams(window.location.search).get('slug');
  if (qs) return qs;

  const segments = window.location.pathname.split('/').filter(Boolean);
  if (segments.length && /\.html$/i.test(segments[segments.length - 1])) segments.pop();
  return segments.length ? segments[segments.length - 1] : null;
}

function isPreview() {
  return new URLSearchParams(window.location.search).get('preview') === '1';
}

// Rewrite relative asset paths to absolute GitHub raw URLs for local preview
function rewriteForPreview(campaign) {
  const base  = 'https://raw.githubusercontent.com/Steel-City-Visuals/SCV-Website/main/';
  const toAbs = s => (s && !/^https?:\/\//.test(s)) ? base + s : s;
  return { ...campaign, image: toAbs(campaign.image) };
}

function render(campaign) {
  const isActive = campaign.active !== false;

  document.getElementById('campaign-hero-bg').style.backgroundImage = `url('${toRootPath(campaign.image)}')`;
  document.getElementById('campaign-title').textContent       = campaign.name;
  document.getElementById('campaign-description').textContent = campaign.description;

  // Inactive campaigns keep the hero + contact form (so visitors can still inquire)
  // but swap in an "ended" banner and re-frame the ask instead of hard-hiding the page.
  document.getElementById('campaign-ended-banner').hidden = isActive;
  document.getElementById('campaign-contact-heading').textContent =
    isActive ? 'Ready to Get Started?' : 'Want to Know When It’s Back?';

  document.title = `${campaign.name}: Steel City Visuals`;

  // Attribution fields for the Formspree submission
  const fieldSlug    = document.getElementById('campaign-field-slug');
  const fieldName    = document.getElementById('campaign-field-name');
  const fieldSubject = document.getElementById('campaign-field-subject');
  if (fieldSlug)    fieldSlug.value    = campaign.slug;
  if (fieldName)    fieldName.value    = campaign.name;
  if (fieldSubject) fieldSubject.value = isActive
    ? `New lead: ${campaign.name}`
    : `Inquiry: ${campaign.name} (campaign inactive)`;

  // SEO / share meta tags
  const metaDesc = campaign.description || '';
  const setMeta  = (id, val) => { const el = document.getElementById(id); if (el) el.setAttribute('content', val); };
  setMeta('meta-description', metaDesc);
  setMeta('og-title',         campaign.name);
  setMeta('og-description',   metaDesc);
  setMeta('og-image',         toAbsoluteURL(campaign.image));
  setMeta('og-url',           `${window.location.origin}/${campaign.slug}`);

  document.getElementById('campaign-loading').hidden = true;
  document.getElementById('campaign-content').hidden = false;
}

function showUnavailable() {
  document.getElementById('campaign-loading').hidden = true;
  const el      = document.getElementById('campaign-unavailable');
  el.querySelector('h1').textContent = 'Campaign Not Found';
  el.querySelector('p').textContent  = "The campaign you're looking for doesn't exist or may have been removed.";
  el.hidden = false;
}

const slug    = getSlug();
const preview = isPreview();
// Locally (Live Server / localhost), images are only on GitHub — always rewrite URLs
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

if (!slug) {
  showUnavailable();
} else if (preview) {
  // Check localStorage first — admin writes live form state here for unsaved previews
  let localCampaign = null;
  try {
    const stored = localStorage.getItem('scv_campaign_preview_draft');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.slug === slug) {
        localCampaign = parsed;
        localStorage.removeItem('scv_campaign_preview_draft');
      }
    }
  } catch {}

  if (localCampaign) {
    render(rewriteForPreview(localCampaign));
  } else {
    // Fall back to GitHub API for saved-but-unpublished campaigns
    fetch(GITHUB_CAMPAIGNS_URL, { headers: { Accept: 'application/vnd.github+json' } })
      .then(r => r.json())
      .then(data => {
        const list     = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(data.content.replace(/\n/g, '')), c => c.charCodeAt(0))));
        const campaign = list.find(c => c.slug === slug);
        campaign ? render(rewriteForPreview(campaign)) : showUnavailable();
      })
      .catch(() => showUnavailable());
  }
} else {
  fetch(CAMPAIGNS_URL)
    .then(r => r.json())
    .then(list => {
      const campaign = list.find(c => c.slug === slug);
      if (!campaign) { showUnavailable(); return; }
      render(isLocal ? rewriteForPreview(campaign) : campaign);
    })
    .catch(() => showUnavailable());
}

// ── Contact form — AJAX submission via Formspree (mirrors js/contact.js) ──

const campaignForm    = document.getElementById('campaign-contact-form');
const campaignSuccess = document.getElementById('campaign-contact-success');

if (campaignForm) {
  campaignForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = campaignForm.querySelector('.contact__submit');
    btn.textContent = 'Sending…';
    btn.disabled = true;

    try {
      const res = await fetch(campaignForm.action, {
        method: 'POST',
        body: new FormData(campaignForm),
        headers: { 'Accept': 'application/json' }
      });

      if (res.ok) {
        btn.textContent = 'Sent!';
        setTimeout(() => {
          campaignForm.hidden = true;
          campaignSuccess.hidden = false;
        }, 600);
      } else {
        btn.textContent = 'Something went wrong, try again';
        btn.disabled = false;
      }
    } catch {
      btn.textContent = 'Something went wrong, try again';
      btn.disabled = false;
    }
  });
}
