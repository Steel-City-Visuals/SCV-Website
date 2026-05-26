// ── Contact form — AJAX submission via Formspree ──

const form    = document.getElementById('contact-form');
const success = document.getElementById('contact-success');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = form.querySelector('.contact__submit');
    btn.textContent = 'Sending…';
    btn.disabled = true;

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      });

      if (res.ok) {
        btn.textContent = 'Sent!';
        setTimeout(() => {
          form.hidden = true;
          success.hidden = false;
        }, 600);
      } else {
        btn.textContent = 'Something went wrong — try again';
        btn.disabled = false;
      }
    } catch {
      btn.textContent = 'Something went wrong — try again';
      btn.disabled = false;
    }
  });
}
