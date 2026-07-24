// Secret knock: click copyright 5 times within 3 seconds → admin
(function () {
  let clicks = 0, timer;
  const el = document.getElementById('footer-copyright');
  if (!el) return;
  el.addEventListener('click', () => {
    clicks++;
    clearTimeout(timer);
    timer = setTimeout(() => { clicks = 0; }, 3000);
    if (clicks >= 5) { clicks = 0; window.location.href = 'admin.html'; }
  });
})();
