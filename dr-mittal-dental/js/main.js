/* ============================================================
   DR. MITTAL'S KIDS DENTAL — MAIN JS
   ============================================================ */

'use strict';

/* ── Preloader ────────────────────────────────────────────── */
window.addEventListener('load', () => {
  const preloader = document.getElementById('preloader');
  if (!preloader) return;
  setTimeout(() => {
    preloader.classList.add('hidden');
    document.body.classList.remove('loading');
    // Trigger hero animations after load
    document.querySelectorAll('[data-hero-anim]').forEach(el => {
      el.style.animationPlayState = 'running';
    });
    initParticles();
  }, 2400);
});

/* ── Scroll Progress ──────────────────────────────────────── */
const scrollBar = document.getElementById('scroll-progress');
window.addEventListener('scroll', () => {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollBar) scrollBar.style.width = (scrollTop / docHeight * 100) + '%';
}, { passive: true });

/* ── Nav Scroll Effect ────────────────────────────────────── */
const nav = document.querySelector('.nav');
const backToTop = document.getElementById('back-to-top');

window.addEventListener('scroll', () => {
  const scrolled = window.scrollY > 60;
  nav?.classList.toggle('scrolled', scrolled);
  backToTop?.classList.toggle('visible', window.scrollY > 400);
}, { passive: true });

backToTop?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ── Hamburger Menu ───────────────────────────────────────── */
const hamburger = document.querySelector('.nav__hamburger');
const mobileMenu = document.querySelector('.nav__mobile');

hamburger?.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  mobileMenu?.classList.toggle('open');
});

document.querySelectorAll('.nav__mobile a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger?.classList.remove('active');
    mobileMenu?.classList.remove('open');
  });
});

/* ── Custom Cursor ────────────────────────────────────────── */
const cursor = document.getElementById('cursor');
const cursorFollower = document.getElementById('cursor-follower');
let mouseX = 0, mouseY = 0;
let followerX = 0, followerY = 0;

if (window.innerWidth > 900) {
  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (cursor) {
      cursor.style.left = mouseX + 'px';
      cursor.style.top  = mouseY + 'px';
    }
  });

  function animateFollower() {
    followerX += (mouseX - followerX) * 0.12;
    followerY += (mouseY - followerY) * 0.12;
    if (cursorFollower) {
      cursorFollower.style.left = followerX + 'px';
      cursorFollower.style.top  = followerY + 'px';
    }
    requestAnimationFrame(animateFollower);
  }
  animateFollower();

  document.querySelectorAll('a, button, .feature-card, .service-card, .blog-card').forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursor?.classList.add('hovering');
      cursorFollower?.classList.add('hovering');
    });
    el.addEventListener('mouseleave', () => {
      cursor?.classList.remove('hovering');
      cursorFollower?.classList.remove('hovering');
    });
  });
}

/* ── Scroll Reveal (Intersection Observer) ────────────────── */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      // For stagger parents
      if (entry.target.classList.contains('stagger')) {
        entry.target.querySelectorAll(':scope > *').forEach(child => {
          child.classList.add('visible');
        });
      }
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

document.querySelectorAll('.fade-up, .fade-left, .fade-right, .zoom-in, .stagger').forEach(el => {
  revealObserver.observe(el);
});

/* ── Animated Counters ────────────────────────────────────── */
function animateCounter(el) {
  const target  = parseInt(el.dataset.target, 10);
  const suffix  = el.dataset.suffix || '';
  const prefix  = el.dataset.prefix || '';
  const duration = 2000;
  const step    = target / (duration / 16);
  let current   = 0;

  const update = () => {
    current += step;
    if (current >= target) {
      el.textContent = prefix + target.toLocaleString() + suffix;
      return;
    }
    el.textContent = prefix + Math.floor(current).toLocaleString() + suffix;
    requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounter(entry.target);
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('[data-counter]').forEach(el => counterObserver.observe(el));

/* ── Testimonial Slider ───────────────────────────────────── */
const track    = document.querySelector('.testimonials__track');
const prevBtn  = document.querySelector('.testimonials__btn--prev');
const nextBtn  = document.querySelector('.testimonials__btn--next');
const dots     = document.querySelectorAll('.testimonials__dot');

if (track) {
  let currentSlide = 0;
  const cards = track.querySelectorAll('.testimonial-card');
  const isMobile = () => window.innerWidth < 900;
  const perSlide = () => isMobile() ? 1 : 3;

  function getMaxSlide() {
    return Math.max(0, cards.length - perSlide());
  }

  function goTo(index) {
    currentSlide = Math.max(0, Math.min(index, getMaxSlide()));
    const cardWidth = cards[0].offsetWidth + 28; // gap
    track.style.transform = `translateX(-${currentSlide * cardWidth}px)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === currentSlide));
  }

  prevBtn?.addEventListener('click', () => goTo(currentSlide - 1));
  nextBtn?.addEventListener('click', () => goTo(currentSlide + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));

  // Auto-advance
  let autoSlide = setInterval(() => goTo(currentSlide + 1 > getMaxSlide() ? 0 : currentSlide + 1), 5000);
  track.addEventListener('mouseenter', () => clearInterval(autoSlide));
  track.addEventListener('mouseleave', () => {
    autoSlide = setInterval(() => goTo(currentSlide + 1 > getMaxSlide() ? 0 : currentSlide + 1), 5000);
  });

  // Touch swipe
  let touchStartX = 0;
  track.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) goTo(diff > 0 ? currentSlide + 1 : currentSlide - 1);
  }, { passive: true });
}

/* ── Particle System ──────────────────────────────────────── */
function initParticles() {
  const container = document.querySelector('.hero__particles');
  if (!container) return;

  const count = window.innerWidth < 600 ? 15 : 30;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      animation-duration: ${4 + Math.random() * 8}s;
      animation-delay: ${-Math.random() * 10}s;
      width: ${3 + Math.random() * 6}px;
      height: ${3 + Math.random() * 6}px;
    `;
    container.appendChild(p);
  }
}

/* ── Floating Teeth Decoration ────────────────────────────── */
function initFloatingTeeth() {
  const sections = document.querySelectorAll('.features, .services, .blog-preview');
  const teeth = ['🦷', '✨', '⭐', '💎', '🌟'];

  sections.forEach(section => {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'floating-tooth';
      el.textContent = teeth[Math.floor(Math.random() * teeth.length)];
      el.style.cssText = `
        left: ${5 + Math.random() * 90}%;
        top:  ${5 + Math.random() * 90}%;
        animation-duration: ${3 + Math.random() * 5}s;
        animation-delay: ${-Math.random() * 5}s;
        font-size: ${16 + Math.random() * 20}px;
      `;
      section.style.position = 'relative';
      section.appendChild(el);
    }
  });
}

initFloatingTeeth();

/* ── Ripple Buttons ───────────────────────────────────────── */
document.querySelectorAll('.btn-ripple').forEach(btn => {
  btn.addEventListener('click', function(e) {
    const rect   = this.getBoundingClientRect();
    const x      = e.clientX - rect.left;
    const y      = e.clientY - rect.top;
    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    ripple.style.cssText = `left:${x}px; top:${y}px; width:20px; height:20px; margin:-10px 0 0 -10px;`;
    this.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
});

/* ── Nav Active Link ──────────────────────────────────────── */
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav__links a, .nav__mobile a').forEach(link => {
  const href = link.getAttribute('href');
  if (href === currentPage || (currentPage === '' && href === 'index.html')) {
    link.classList.add('active');
  }
});

/* ── Appointment Form Submission ──────────────────────────── */
const apptForm = document.getElementById('appointment-form');
apptForm?.addEventListener('submit', function(e) {
  e.preventDefault();
  const btn = this.querySelector('.btn-submit');
  const original = btn.innerHTML;
  btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;display:inline-block;vertical-align:middle;"></span> Booking...';
  btn.disabled = true;

  setTimeout(() => {
    btn.innerHTML = '✅ Appointment Booked!';
    btn.style.background = 'linear-gradient(135deg, #748F3A, #93B248)';
    showToast('Appointment request sent! We\'ll confirm within 2 hours.', 'success');

    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.background = '';
      btn.disabled = false;
      apptForm.reset();
    }, 4000);
  }, 2000);
});

/* ── Toast ────────────────────────────────────────────────── */
function showToast(message, type = '') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type ? 'toast--' + type : ''}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* ── Scroll Indicator ─────────────────────────────────────── */
document.querySelector('.scroll-indicator')?.addEventListener('click', () => {
  const target = document.querySelector('.features') ||
                 document.querySelector('section:nth-of-type(2)');
  target?.scrollIntoView({ behavior: 'smooth' });
});

/* ── Staggered Card Reveal (per section) ──────────────────── */
const cardRevealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const cards = entry.target.querySelectorAll(
      '.feature-card, .service-card, .blog-card, .testimonial-card, .school-stat-card'
    );
    cards.forEach((card, i) => {
      setTimeout(() => {
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, i * 100);
    });
    cardRevealObserver.unobserve(entry.target);
  });
}, { threshold: 0.1 });

document.querySelectorAll('.features__grid, .services__grid, .blog__grid, .school-stats').forEach(grid => {
  grid.querySelectorAll('.feature-card, .service-card, .blog-card, .school-stat-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  });
  cardRevealObserver.observe(grid);
});

/* ── Tilt Effect on Cards ─────────────────────────────────── */
if (window.innerWidth > 900) {
  document.querySelectorAll('.tilt-card').forEach(card => {
    card.addEventListener('mousemove', function(e) {
      const rect   = this.getBoundingClientRect();
      const x      = (e.clientX - rect.left) / rect.width  - 0.5;
      const y      = (e.clientY - rect.top)  / rect.height - 0.5;
      this.style.transform = `perspective(1000px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) scale(1.02)`;
    });
    card.addEventListener('mouseleave', function() {
      this.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg) scale(1)';
    });
  });
}

/* ── Map Dots Animation ───────────────────────────────────── */
function initMapDots() {
  const mapDots = document.querySelector('.map-dots');
  if (!mapDots) return;
  const positions = [
    { left: '25%', top: '40%' }, // India
    { left: '55%', top: '35%' }, // Middle East
    { left: '80%', top: '45%' }, // US East
    { left: '72%', top: '30%' }, // UK
    { left: '20%', top: '50%' }, // Europe
    { left: '85%', top: '55%' }, // Australia
  ];
  positions.forEach((pos, i) => {
    const dot = document.createElement('div');
    dot.className = 'map-dot';
    dot.style.cssText = `left:${pos.left}; top:${pos.top}; animation-delay:${i * 0.4}s;`;
    dot.style.background = i % 3 === 0 ? 'var(--blue)' : i % 3 === 1 ? 'var(--yellow-dark)' : 'var(--green)';
    mapDots.appendChild(dot);
  });
}

initMapDots();

/* ── Parallax on Hero ─────────────────────────────────────── */
window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  const heroContent = document.querySelector('.hero__content');
  if (heroContent && scrollY < window.innerHeight) {
    heroContent.style.transform = `translateY(${scrollY * 0.2}px)`;
    heroContent.style.opacity   = 1 - scrollY / (window.innerHeight * 0.7);
  }
}, { passive: true });

/* ── Page Init ────────────────────────────────────────────── */
document.body.classList.add('loading');

// Set min date for date inputs to today
document.querySelectorAll('input[type="date"]').forEach(input => {
  const today = new Date().toISOString().split('T')[0];
  input.min = today;
});

console.log('%c 🦷 Dr. Mittal\'s Kids Dental ', 'background:#2C9DA8;color:#fff;font-size:16px;padding:8px 16px;border-radius:8px;font-weight:bold;');
