// ── Scroll reveal + stat counter + hero parallax ──
// Initializes after render.js fires 'scv:ready' so all elements exist.

function initAnimations() {

  // ── Scroll reveal ──
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // ── Stat counter ──
  function animateCount(el) {
    const target   = parseInt(el.dataset.target, 10);
    const prefix   = el.dataset.prefix  || '';
    const suffix   = el.dataset.suffix  || '';
    const duration = 1800;
    const steps    = 60;
    const increment = target / steps;
    let current    = 0;
    let step       = 0;

    const format = n => Math.round(n).toLocaleString('en-US');

    const timer = setInterval(() => {
      step++;
      current += increment;
      if (step >= steps) {
        el.textContent = prefix + format(target) + suffix;
        clearInterval(timer);
      } else {
        const progress = step / steps;
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = prefix + format(target * eased) + suffix;
      }
    }, duration / steps);
  }

  const statObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        statObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.stats__count').forEach(el => statObserver.observe(el));

  // ── Hero parallax ──
  const heroBg = document.querySelector('.hero__bg');
  if (heroBg) {
    window.addEventListener('scroll', () => {
      heroBg.style.transform = `scale(1.05) translateY(${window.scrollY * 0.3}px)`;
    }, { passive: true });
  }
}

// Run immediately if render.js already finished, otherwise wait for it
if (window._scvReady) {
  initAnimations();
} else {
  document.addEventListener('scv:ready', initAnimations, { once: true });
}
