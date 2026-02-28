// ====== ENHANCED ANIMATIONS ENGINE ======

// --- Scroll Progress Bar ---
function updateScrollProgress() {
  const el = document.getElementById('scrollProgress');
  if (!el) return;
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = (scrollTop / docHeight) * 100;
  el.style.width = progress + '%';
}
window.addEventListener('scroll', updateScrollProgress, { passive: true });

// --- Floating Particles (disabled on mobile for performance) ---
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  // Skip particles on mobile (< 768px) for performance
  if (window.innerWidth < 768) { container.style.display = 'none'; return; }
  const colors = ['rgba(193,167,111,0.15)', 'rgba(193,167,111,0.1)', 'rgba(44,62,80,0.06)', 'rgba(173,216,230,0.12)'];
  const particleCount = window.innerWidth < 1024 ? 10 : 20;
  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 12 + 4;
    p.style.cssText = `
      width: ${size}px; height: ${size}px;
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${Math.random() * 15 + 10}s;
      animation-delay: ${Math.random() * 10}s;
    `;
    container.appendChild(p);
  }
}
createParticles();

// --- Hero Title Word-by-Word Animation ---
function animateHeroTitle() {
  const title = document.querySelector('.hero-title');
  if (!title) return;
  const text = title.textContent;
  const words = text.split(' ');
  title.textContent = '';
  words.forEach((word, i) => {
    const span = document.createElement('span');
    span.className = 'hero-word';
    span.textContent = word;
    span.style.animationDelay = (0.15 + i * 0.12) + 's';
    title.appendChild(span);
    if (i < words.length - 1) title.appendChild(document.createTextNode(' '));
  });
}
animateHeroTitle();

// --- Enhanced Reveal Observer with stagger ---
const allRevealElements = document.querySelectorAll('.reveal, .reveal-up, .reveal-left, .reveal-right, .reveal-scale, .stagger-anim');
const enhancedObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      // Stagger children if applicable
      if (entry.target.classList.contains('stagger-anim')) {
        const children = entry.target.children;
        Array.from(children).forEach((child, i) => {
          setTimeout(() => {
            child.style.opacity = '1';
            child.style.transform = 'translateY(0)';
          }, i * 120);
        });
      }
      enhancedObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });
allRevealElements.forEach(el => enhancedObserver.observe(el));

// --- Ripple Effect on Buttons ---
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.ripple-btn');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size/2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size/2) + 'px';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});

// --- 3D Tilt Effect on Product Cards (desktop only, disabled on touch devices) ---
function bindTiltToCard(card) {
  if (card.dataset.tiltBound) return;
  card.dataset.tiltBound = '1';
  // Skip tilt on touch/mobile devices
  if ('ontouchstart' in window || window.innerWidth < 768) return;
  card.addEventListener('mousemove', function(e) {
    const rect = this.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / 20;
    const rotateY = (centerX - x) / 20;
    this.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
  });
  card.addEventListener('mouseleave', function() {
    this.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale(1)';
    this.style.transition = 'transform 0.5s ease';
  });
  card.addEventListener('mouseenter', function() {
    this.style.transition = 'transform 0.1s ease';
  });
}
// Bind to existing cards
document.querySelectorAll('.product-card').forEach(bindTiltToCard);
// Observe for dynamically added cards (Shopify)
const tiltObserver = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === 1) {
        if (node.classList && node.classList.contains('product-card')) bindTiltToCard(node);
        node.querySelectorAll && node.querySelectorAll('.product-card').forEach(bindTiltToCard);
      }
    });
  });
});
tiltObserver.observe(document.body, { childList: true, subtree: true });

// --- Cart Badge Bounce Animation ---
const originalAddToCart = window.addToCartStatic;
if (typeof addToCartStatic === 'function') {
  const origFunc = addToCartStatic;
  window.addToCartStatic = function() {
    origFunc.apply(this, arguments);
    const badge = document.getElementById('cartBadge');
    if (badge) {
      badge.classList.remove('bounce');
      void badge.offsetWidth; // reflow
      badge.classList.add('bounce');
    }
  };
}

// --- Parallax Effect on Scroll (desktop only) ---
let ticking = false;
if (window.innerWidth < 768) { /* skip parallax on mobile */ } else
window.addEventListener('scroll', function() {
  if (!ticking) {
    requestAnimationFrame(function() {
      const scrolled = window.scrollY;
      // Subtle parallax on hero floating elements
      document.querySelectorAll('.hero-float-1, .hero-float-2, .hero-float-3').forEach((el, i) => {
        const speed = 0.3 + (i * 0.1);
        el.style.transform = `translateY(${scrolled * speed * -0.3}px)`;
      });
      ticking = false;
    });
    ticking = true;
  }
}, { passive: true });

// --- Smooth counter for section numbers (brand values) ---
function animateCounters() {
  document.querySelectorAll('.value-number').forEach(el => {
    const target = parseInt(el.textContent);
    if (isNaN(target)) return;
    let current = 0;
    const increment = target / 40;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        el.textContent = target + (el.dataset.suffix || '');
        clearInterval(timer);
      } else {
        el.textContent = Math.floor(current) + (el.dataset.suffix || '');
      }
    }, 30);
  });
}
// Trigger counter animation when visible
const valuesSection = document.querySelector('.brand-values');
if (valuesSection) {
  const counterObs = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      animateCounters();
      counterObs.disconnect();
    }
  }, { threshold: 0.5 });
  counterObs.observe(valuesSection);
}

// --- Navbar hide on scroll down, show on scroll up ---
let lastScrollTop = 0;
const navEl = document.getElementById('navbar');
window.addEventListener('scroll', function() {
  const st = window.scrollY;
  if (st > 300 && st > lastScrollTop) {
    navEl.style.transform = 'translateY(-100%)';
  } else {
    navEl.style.transform = 'translateY(0)';
  }
  lastScrollTop = st;
}, { passive: true });

// --- Typing cursor effect on hero (subtle) ---
const heroCta = document.querySelector('.hero-cta');
if (heroCta) {
  heroCta.style.position = 'relative';
}

// --- Force Video Autoplay on Mobile ---
(function() {
  const video = document.getElementById('heroVideo');
  if (!video) return;

  function tryPlay() {
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(function() {
        // Autoplay blocked — retry on first user interaction
        function playOnInteraction() {
          video.play().catch(function(){});
          document.removeEventListener('touchstart', playOnInteraction);
          document.removeEventListener('click', playOnInteraction);
          document.removeEventListener('scroll', playOnInteraction);
        }
        document.addEventListener('touchstart', playOnInteraction, { once: true, passive: true });
        document.addEventListener('click', playOnInteraction, { once: true });
        document.addEventListener('scroll', playOnInteraction, { once: true, passive: true });
      });
    }
  }

  // Try immediately
  if (document.readyState === 'complete') {
    tryPlay();
  } else {
    window.addEventListener('load', tryPlay);
  }

  // Also retry when video data is loaded
  video.addEventListener('loadeddata', function() {
    if (video.paused) tryPlay();
  });
})();

// --- Fix mobile viewport height (100vh bug with address bar) ---
function setMobileVH() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', vh + 'px');
}
setMobileVH();
window.addEventListener('resize', setMobileVH, { passive: true });

console.log('Pro Pure animations loaded ✨');

