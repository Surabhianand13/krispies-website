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
const BACKEND_URL = 'https://krispies-website.onrender.com';

const form = document.getElementById('contactForm');
const successPanel = document.querySelector('.form-success');
if (form) {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    btn.textContent = 'Sending…';
    btn.disabled = true;

    const payload = {
      name:      (form.querySelector('#name')       ?.value || '').trim(),
      phone:     (form.querySelector('#phone')      ?.value || '').trim(),
      email:     (form.querySelector('#email')      ?.value || '').trim(),
      eventType: (form.querySelector('#event-type') ?.value || ''),
      outlet:    (form.querySelector('#outlet')     ?.value || ''),
      quantity:  (form.querySelector('#quantity')   ?.value || '').trim(),
      eventDate: (form.querySelector('#event-date') ?.value || ''),
      products:  (form.querySelector('#products')   ?.value || '').trim(),
      message:   (form.querySelector('#message')    ?.value || '').trim(),
    };

    let sent = false;
    try {
      const res = await fetch(`${BACKEND_URL}/api/messages`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      sent = res.ok;
    } catch (_) { /* backend unavailable — fall through to localStorage */ }

    // Fallback: save minimal record to localStorage when backend is offline.
    // Email and other non-essential PII are intentionally omitted — name + phone
    // are enough for the admin to follow up.
    if (!sent) {
      try {
        const enquiry = {
          id:          Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          name:        payload.name,
          phone:       payload.phone,
          eventType:   payload.eventType,
          outlet:      payload.outlet,
          eventDate:   payload.eventDate,
          message:     payload.message,
          status:      'unread',
          submittedAt: new Date().toISOString(),
        };
        const existing = JSON.parse(localStorage.getItem('krispies_enquiries') || '[]');
        existing.unshift(enquiry);
        localStorage.setItem('krispies_enquiries', JSON.stringify(existing));
      } catch (_) { /* storage unavailable */ }
    }

    form.style.display = 'none';
    if (successPanel) successPanel.style.display = 'block';
    btn.textContent = 'Send Enquiry';
    btn.disabled = false;
  });
}

/* ---- HERO BANNER CAROUSEL ---- */
(function () {
  const track    = document.getElementById('heroTrack');
  const dotsWrap = document.getElementById('heroDots');
  const prevBtn  = document.getElementById('heroPrev');
  const nextBtn  = document.getElementById('heroNext');
  if (!track) return;

  const slides = [...track.querySelectorAll('.hero__slide')];
  const total  = slides.length;
  let cur      = 0;
  let timer;
  let startX   = null; // for swipe support

  // Build dots
  if (dotsWrap) {
    slides.forEach((_, i) => {
      const d = document.createElement('button');
      d.className  = 'hero__dot' + (i === 0 ? ' active' : '');
      d.setAttribute('aria-label', `Go to slide ${i + 1}`);
      d.setAttribute('role', 'tab');
      d.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      d.addEventListener('click', () => go(i));
      dotsWrap.appendChild(d);
    });
  }

  function go(idx) {
    cur = (idx + total) % total;
    track.style.transform = `translateX(-${cur * 100}%)`;
    if (dotsWrap) {
      dotsWrap.querySelectorAll('.hero__dot').forEach((d, i) => {
        d.classList.toggle('active', i === cur);
        d.setAttribute('aria-selected', i === cur ? 'true' : 'false');
      });
    }
  }

  function next() { go(cur + 1); }
  function prev() { go(cur - 1); }

  if (nextBtn) nextBtn.addEventListener('click', () => { next(); resetTimer(); });
  if (prevBtn) prevBtn.addEventListener('click', () => { prev(); resetTimer(); });

  // Auto-advance every 5 seconds
  function startTimer() { timer = setInterval(next, 5000); }
  function resetTimer() { clearInterval(timer); startTimer(); }

  // Pause on hover
  track.closest('.hero')?.addEventListener('mouseenter', () => clearInterval(timer));
  track.closest('.hero')?.addEventListener('mouseleave', startTimer);

  // Touch / swipe support
  track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) { dx < 0 ? next() : prev(); resetTimer(); }
    startX = null;
  }, { passive: true });

  // Keyboard accessibility
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { next(); resetTimer(); }
    if (e.key === 'ArrowLeft')  { prev(); resetTimer(); }
  });

  startTimer();
})();

/* ---- WHATSAPP FLOAT BUTTON + FOOTER ROW ---- */
(function () {
  const WA_HREF = 'https://wa.me/917975218850?text=' + encodeURIComponent("Hi Krispie's! I'd like to place an order.");

  // Floating button
  const btn = document.createElement('a');
  btn.href = WA_HREF;
  btn.target = '_blank';
  btn.rel = 'noopener noreferrer';
  btn.className = 'wa-float';
  btn.setAttribute('aria-label', 'Chat with us on WhatsApp');
  btn.innerHTML =
    '<span class="wa-float__pulse"></span>' +
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>' +
    '</svg>';
  document.body.appendChild(btn);

  // Footer "Connect With Us" row
  const footerRows = document.querySelectorAll('.footer__contact-row');
  if (footerRows.length) {
    const waRow = document.createElement('div');
    waRow.className = 'footer__contact-row';
    waRow.innerHTML =
      '<span class="footer__contact-icon" style="color:#25D366">💬</span>' +
      '<span class="footer__contact-text"><a href="' + WA_HREF + '" target="_blank" rel="noopener">WhatsApp: +91 79752 18850</a></span>';
    footerRows[footerRows.length - 1].insertAdjacentElement('afterend', waRow);
  }
})();

/* ---- SMOOTH SECTION SCROLL from hash links ---- */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});
