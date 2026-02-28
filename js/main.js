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
  autoplayInterval = setInterval(() => changeSlide(1), 5000);
}

function resetAutoplay() {
  clearInterval(autoplayInterval);
  startAutoplay();
}

startAutoplay();

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

// ============ SCROLL REVEAL ANIMATIONS ============
const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, {
  threshold: 0.15,
  rootMargin: '0px 0px -50px 0px'
});

revealElements.forEach(el => revealObserver.observe(el));

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
      else if (filter === 'adoucissants') show = pType.includes('adoucissant') || title.includes('adoucissant');
      else if (filter === 'nettoyant-luxe') show = (pType.includes('nettoyant') || title.includes('nettoyant')) && (title.includes('luxe') || pType.includes('luxe'));
      else if (filter === 'nettoyant-classique') show = (pType.includes('nettoyant') || title.includes('nettoyant')) && (title.includes('classique') || pType.includes('classique'));
      else if (filter === 'entretien') show = pType.includes('entretien') || title.includes('entretien') || title.includes('dégraissant') || pType.includes('nettoyant multi');
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

// ============ PARALLAX FLOATING ELEMENTS ============
document.addEventListener('mousemove', (e) => {
  const x = (e.clientX / window.innerWidth - 0.5) * 20;
  const y = (e.clientY / window.innerHeight - 0.5) * 20;
  document.querySelectorAll('.hero-floating').forEach((el, i) => {
    const speed = (i + 1) * 0.5;
    el.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
  });
});

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
  burger.classList.toggle('active');
  overlay.classList.toggle('active');
  document.body.style.overflow = overlay.classList.contains('active') ? 'hidden' : '';
}
function closeMobileNav() {
  const burger = document.getElementById('burgerMenu');
  const overlay = document.getElementById('mobileNavOverlay');
  burger.classList.remove('active');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}
// Close mobile nav on resize to desktop
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) closeMobileNav();
});
