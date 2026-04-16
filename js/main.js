/* ================================================
   KRISPIE'S — Main JavaScript
   ================================================ */

'use strict';

/* ---- NAV: scroll state ---- */
const nav = document.querySelector('.nav');
if (nav) {
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 60);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---- NAV: hamburger ---- */
const burger   = document.querySelector('.nav__hamburger');
const mobileMenu = document.querySelector('.nav__mobile');
if (burger && mobileMenu) {
  burger.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    burger.setAttribute('aria-expanded', open);
    const [s1,,s3] = burger.querySelectorAll('span');
    if (open) {
      burger.querySelectorAll('span')[0].style.cssText = 'transform:translateY(7px) rotate(45deg)';
      burger.querySelectorAll('span')[1].style.opacity = '0';
      burger.querySelectorAll('span')[2].style.cssText = 'transform:translateY(-7px) rotate(-45deg)';
    } else {
      burger.querySelectorAll('span').forEach(s => s.removeAttribute('style'));
    }
  });
  mobileMenu.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      burger.querySelectorAll('span').forEach(s => s.removeAttribute('style'));
    })
  );
}

/* ---- NAV: active page highlight ---- */
const page = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav__links a, .nav__mobile a').forEach(a => {
  if (a.getAttribute('href') === page) a.classList.add('active');
});

/* ---- SCROLL ANIMATIONS ---- */
const fadeEls = document.querySelectorAll('.fade-up');
if (fadeEls.length && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  fadeEls.forEach(el => io.observe(el));
} else {
  fadeEls.forEach(el => el.classList.add('visible'));
}

/* ---- TESTIMONIALS CAROUSEL ---- */
(function () {
  const track = document.querySelector('.testimonials__track');
  if (!track) return;

  const cards   = [...track.querySelectorAll('.tcard')];
  const total   = cards.length;
  const dotsWrap = document.querySelector('.tctl-dots');
  let cur = 0, timer;

  function visible() {
    if (window.innerWidth < 700) return 1;
    if (window.innerWidth < 1060) return 2;
    return 3;
  }

  function maxIdx() { return Math.max(0, total - visible()); }

  function go(idx) {
    cur = Math.max(0, Math.min(idx, maxIdx()));
    const w = cards[0].getBoundingClientRect().width + 22;
    track.style.transform = `translateX(-${cur * w}px)`;
    if (dotsWrap) {
      dotsWrap.querySelectorAll('.tctl-dot').forEach((d, i) =>
        d.classList.toggle('active', i === cur));
    }
  }

  function next() { go(cur >= maxIdx() ? 0 : cur + 1); }
  function prev() { go(cur <= 0 ? maxIdx() : cur - 1); }

  const nextBtn = document.querySelector('.tctl-btn--next');
  const prevBtn = document.querySelector('.tctl-btn--prev');
  if (nextBtn) nextBtn.addEventListener('click', next);
  if (prevBtn) prevBtn.addEventListener('click', prev);

  // build dots
  if (dotsWrap) {
    for (let i = 0; i < total; i++) {
      const d = document.createElement('button');
      d.className = 'tctl-dot' + (i === 0 ? ' active' : '');
      d.setAttribute('aria-label', `Slide ${i + 1}`);
      d.addEventListener('click', () => go(i));
      dotsWrap.appendChild(d);
    }
  }

  // auto-play
  function startTimer() { timer = setInterval(next, 5000); }
  function stopTimer()  { clearInterval(timer); }
  track.closest('.testimonials')?.addEventListener('mouseenter', stopTimer);
  track.closest('.testimonials')?.addEventListener('mouseleave', startTimer);
  startTimer();

  window.addEventListener('resize', () => go(cur), { passive: true });
})();

/* ---- CONTACT FORM ---- */
const form = document.getElementById('contactForm');
const successPanel = document.querySelector('.form-success');
if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    btn.textContent = 'Sending…';
    btn.disabled = true;

    // Save enquiry to localStorage so admin panel can view it
    const enquiry = {
      id:          Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name:        (form.querySelector('#name')        ?.value || '').trim(),
      phone:       (form.querySelector('#phone')       ?.value || '').trim(),
      email:       (form.querySelector('#email')       ?.value || '').trim(),
      eventType:   (form.querySelector('#event-type')  ?.value || ''),
      outlet:      (form.querySelector('#outlet')      ?.value || ''),
      quantity:    (form.querySelector('#quantity')    ?.value || '').trim(),
      eventDate:   (form.querySelector('#event-date')  ?.value || ''),
      products:    (form.querySelector('#products')    ?.value || '').trim(),
      message:     (form.querySelector('#message')     ?.value || '').trim(),
      status:      'unread',
      submittedAt: new Date().toISOString(),
    };
    try {
      const existing = JSON.parse(localStorage.getItem('krispies_enquiries') || '[]');
      existing.unshift(enquiry);
      localStorage.setItem('krispies_enquiries', JSON.stringify(existing));
    } catch (_) { /* storage unavailable — fail silently */ }

    setTimeout(() => {
      form.style.display = 'none';
      if (successPanel) successPanel.style.display = 'block';
    }, 1200);
  });
}

/* ---- SMOOTH SECTION SCROLL from hash links ---- */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});
