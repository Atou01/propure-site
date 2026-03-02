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
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  });
}

// Scroll reveal handled by animations.js (enhanced observer with unobserve + stagger)

// ============ PRODUCTS CAROUSEL SCROLL ============
function scrollCarousel(direction) {
  const carousel = document.getElementById('productsCarousel');
  if (!carousel) return;
  const scrollAmount = 300;
  carousel.scrollBy({
    left: direction * scrollAmount,
    behavior: 'smooth'
  });
}

// ============ CATALOGUE SEARCH ============
const catalogueSearchInput = document.getElementById('catalogueSearch');
if (catalogueSearchInput) {
  let searchDebounce;
  catalogueSearchInput.addEventListener('input', function() {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(function() {
      const query = catalogueSearchInput.value.trim().toLowerCase();
      const cards = document.querySelectorAll('#catalogueGrid .product-card');
      const noResults = document.getElementById('searchNoResults');
      let visibleCount = 0;

      // Reset filter to "Tous" when searching
      if (query.length > 0) {
        document.querySelectorAll('.catalogue-filter-btn').forEach(function(b) {
          b.classList.remove('active');
          if (b.getAttribute('data-filter') === 'all') b.classList.add('active');
        });
      }

      cards.forEach(function(card) {
        if (query.length === 0) {
          card.style.display = '';
          visibleCount++;
          return;
        }
        const title = (card.querySelector('.product-name')?.textContent || '').toLowerCase();
        const desc = (card.querySelector('.product-desc')?.textContent || '').toLowerCase();
        const pType = (card.getAttribute('data-product-type') || '').toLowerCase();
        const tags = (card.getAttribute('data-tags') || '').toLowerCase();
        const match = title.includes(query) || desc.includes(query) || pType.includes(query) || tags.includes(query);
        card.style.display = match ? '' : 'none';
        if (match) visibleCount++;
      });

      if (noResults) noResults.style.display = (query.length > 0 && visibleCount === 0) ? 'block' : 'none';
    }, 250);
  });
}

// ============ CATALOGUE FILTER BUTTONS ============
document.querySelectorAll('.catalogue-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // Clear search when clicking filter
    const searchInput = document.getElementById('catalogueSearch');
    if (searchInput) searchInput.value = '';
    const noResults = document.getElementById('searchNoResults');
    if (noResults) noResults.style.display = 'none';

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

// Parallax on hero floating elements handled by animations.js

// ============ SMOOTH ANCHOR SCROLL ============
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (!href || href === '#') return;
    const target = document.getElementById(href.slice(1));
    if (target) {
      e.preventDefault();
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
    const firstLink = overlay.querySelector('a');
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
    const cartDrawer = document.getElementById('cartDrawer');
    if (cartDrawer && cartDrawer.classList.contains('open')) {
      toggleCart();
      const cartBtn = document.querySelector('.nav-cart');
      if (cartBtn) cartBtn.focus();
      return;
    }
    // Close mobile nav
    const mobileNav = document.getElementById('mobileNavOverlay');
    if (mobileNav && mobileNav.classList.contains('active')) {
      closeMobileNav();
      const burger = document.getElementById('burgerMenu');
      if (burger) burger.focus();
      return;
    }
    // Close cookie banner
    const cookieBanner = document.getElementById('cookieBanner');
    if (cookieBanner && cookieBanner.classList.contains('show')) {
      cookieBanner.classList.remove('show');
      return;
    }
  }

  // Focus trap for cart drawer
  if (e.key === 'Tab') {
    const drawer = document.getElementById('cartDrawer');
    if (drawer && drawer.classList.contains('open')) {
      const focusable = drawer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
  }
});

// ============ NEWSLETTER ============
function handleNewsletter(e) {
  e.preventDefault();
  const form = document.getElementById('newsletterForm');
  const success = document.getElementById('newsletterSuccess');
  if (form && success) {
    form.style.display = 'none';
    success.style.display = 'block';
  }
  return false;
}

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
