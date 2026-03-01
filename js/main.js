// ============ HERO CAROUSEL ============
let currentSlide = 0;
const slides = document.querySelectorAll('.hero-slide');
const dots = document.querySelectorAll('.hero-dot');
let autoplayInterval;

function goToSlide(index) {
  if (!slides.length) return;
  slides[currentSlide].classList.remove('active');
  if (dots[currentSlide]) dots[currentSlide].classList.remove('active');
  currentSlide = (index + slides.length) % slides.length;
  slides[currentSlide].classList.add('active');
  if (dots[currentSlide]) dots[currentSlide].classList.add('active');
}

function changeSlide(direction) {
  if (!slides.length) return;
  goToSlide(currentSlide + direction);
  resetAutoplay();
}

function startAutoplay() {
  if (!slides.length) return;
  // Respect reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  autoplayInterval = setInterval(() => changeSlide(1), 5000);
}

function stopAutoplay() {
  clearInterval(autoplayInterval);
}

function resetAutoplay() {
  stopAutoplay();
  startAutoplay();
}

startAutoplay();

// Pause autoplay on hover/focus
const heroSection = document.getElementById('hero');
if (heroSection) {
  heroSection.addEventListener('mouseenter', stopAutoplay);
  heroSection.addEventListener('mouseleave', resetAutoplay);
  heroSection.addEventListener('focusin', stopAutoplay);
  heroSection.addEventListener('focusout', resetAutoplay);
}

// Touch/swipe support for hero
let touchStartX = 0;
const heroEl = document.getElementById('hero');
if (heroEl) {
  heroEl.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; });
  heroEl.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      changeSlide(diff > 0 ? 1 : -1);
    }
  });
}

// ============ NAVBAR SCROLL ============
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// Scroll reveal handled by animations.js (enhanced observer with unobserve + stagger)

// ============ PRODUCTS CAROUSEL SCROLL ============
function scrollCarousel(direction) {
  const carousel = document.getElementById('productsCarousel');
  const scrollAmount = 300;
  carousel.scrollBy({
    left: direction * scrollAmount,
    behavior: 'smooth'
  });
}

// ============ CATALOGUE FILTER BUTTONS ============
document.querySelectorAll('.catalogue-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.catalogue-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.getAttribute('data-filter');
    const cards = document.querySelectorAll('#catalogueGrid .product-card');
    cards.forEach(card => {
      if (filter === 'all') {
        card.style.display = '';
        return;
      }
      const pType = (card.getAttribute('data-product-type') || '').toLowerCase();
      const tags = (card.getAttribute('data-tags') || '').toLowerCase();
      const title = (card.querySelector('.product-name')?.textContent || '').toLowerCase();
      let show = false;
      if (filter === 'lessives') show = pType.includes('lessive') || title.includes('lessive');
      else if (filter === 'adoucissants') show = pType.includes('adoucissant') || pType.includes('adoucisant') || title.includes('adoucissant');
      else if (filter === 'nettoyant-luxe') show = (pType.includes('nettoyant') || title.includes('nettoyant')) && (title.includes('luxe') || pType.includes('luxe'));
      else if (filter === 'nettoyant-classique') show = (pType.includes('nettoyant') || title.includes('nettoyant')) && (title.includes('classique') || pType.includes('classique') || pType.includes('classic'));
      else if (filter === 'entretien') show = pType.includes('entretien') || title.includes('entretien') || title.includes('dégraissant') || pType.includes('nettoyant multi') || pType.includes('détac');
      card.style.display = show ? '' : 'none';
    });
  });
});

// Legacy cat-pill support (if any remain)
document.querySelectorAll('.cat-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
  });
});

// Parallax on hero floating elements handled by animations.js

// ============ SMOOTH ANCHOR SCROLL ============
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (!href || href === '#') return; // Don't block empty links
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// Mobile navigation
function toggleMobileNav() {
  const burger = document.getElementById('burgerMenu');
  const overlay = document.getElementById('mobileNavOverlay');
  const isOpen = !overlay.classList.contains('active');
  burger.classList.toggle('active');
  overlay.classList.toggle('active');
  burger.setAttribute('aria-expanded', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
  if (isOpen) {
    var firstLink = overlay.querySelector('a');
    if (firstLink) firstLink.focus();
  }
}
function closeMobileNav() {
  const burger = document.getElementById('burgerMenu');
  const overlay = document.getElementById('mobileNavOverlay');
  burger.classList.remove('active');
  overlay.classList.remove('active');
  burger.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}
// Close mobile nav on resize to desktop
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) closeMobileNav();
});

// ============ KEYBOARD ACCESSIBILITY ============
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    // Close cart drawer
    var cartDrawer = document.getElementById('cartDrawer');
    if (cartDrawer && cartDrawer.classList.contains('open')) {
      toggleCart();
      var cartBtn = document.querySelector('.nav-cart');
      if (cartBtn) cartBtn.focus();
      return;
    }
    // Close mobile nav
    var mobileNav = document.getElementById('mobileNavOverlay');
    if (mobileNav && mobileNav.classList.contains('active')) {
      closeMobileNav();
      var burger = document.getElementById('burgerMenu');
      if (burger) burger.focus();
      return;
    }
    // Close cookie banner
    var cookieBanner = document.getElementById('cookieBanner');
    if (cookieBanner && cookieBanner.classList.contains('show')) {
      cookieBanner.classList.remove('show');
      return;
    }
  }

  // Focus trap for cart drawer
  if (e.key === 'Tab') {
    var drawer = document.getElementById('cartDrawer');
    if (drawer && drawer.classList.contains('open')) {
      var focusable = drawer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
  }
});

// ============ GAMME CARDS — WHOLE CARD CLICKABLE ============
document.querySelectorAll('.gamme-card').forEach(card => {
  card.addEventListener('click', function(e) {
    // If user clicked the link itself, let it work naturally
    if (e.target.closest('.gamme-link')) return;
    const link = this.querySelector('.gamme-link');
    if (link && link.href) {
      window.location.href = link.href;
    }
  });
});
