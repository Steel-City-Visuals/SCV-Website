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
  const target  = parseInt(el.dataset.target, 10);
  const prefix  = el.dataset.prefix  || '';
  const suffix  = el.dataset.suffix  || '';
  const duration = 1800; // ms
  const steps    = 60;
  const increment = target / steps;
  let current    = 0;
  let step       = 0;

  // Format large numbers with commas
  const format = n => Math.round(n).toLocaleString('en-US');

  const timer = setInterval(() => {
    step++;
    current += increment;
    if (step >= steps) {
      el.textContent = prefix + format(target) + suffix;
      clearInterval(timer);
    } else {
      // Ease out: slow down near the end
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
    const scrolled = window.scrollY;
    // Subtle: move bg up at 30% of scroll speed
    heroBg.style.transform = `scale(1.05) translateY(${scrolled * 0.3}px)`;
  }, { passive: true });
}
