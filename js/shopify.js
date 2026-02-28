// ============ SHOPIFY BUY SDK ============
const SHOPIFY_DOMAIN = '2gchuh-tt.myshopify.com';
const STOREFRONT_TOKEN = '53cac02ce08a74431eac8f362fc82686';
let shopifyClient;

// --- Security: HTML escape utility ---
function escapeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
let shopifyCheckout;
let cartItemsData = [];

async function initShopify() {
  if (typeof ShopifyBuy === 'undefined') {
    console.warn('Shopify Buy SDK not loaded, using static mode');
    return;
  }
  try {
    shopifyClient = ShopifyBuy.buildClient({
      domain: SHOPIFY_DOMAIN,
      storefrontAccessToken: STOREFRONT_TOKEN,
    });
    shopifyCheckout = await shopifyClient.checkout.create();
    // Fetch real products and update the UI
    const products = await shopifyClient.product.fetchAll(20);
    if (products.length > 0) {
      updateProductsFromShopify(products);
    }
    console.log('Shopify connected! ' + products.length + ' products loaded.');
  } catch (err) {
    console.warn('Shopify init error:', err);
  }
}

// Store all Shopify products for filtering
let allShopifyProducts = [];

function buildProductCard(product, i, tagLabel) {
  const variant = product.variants[0];
  const price = parseFloat(variant.price.amount || variant.price).toFixed(2).replace('.', ',');
  const imgSrc = product.images[0] ? product.images[0].src : '';
  const saving = (parseFloat(price.replace(',', '.')) * 0.1).toFixed(2).replace('.', ',');

  const card = document.createElement('div');
  card.className = 'product-card reveal visible';
  card.setAttribute('data-base-price', price);
  // Store product type for filtering
  const pType = (product.productType || '').toLowerCase();
  card.setAttribute('data-product-type', pType);
  const tags = product.tags || [];
  card.setAttribute('data-tags', tags.join(',').toLowerCase());

  const handle = product.handle || '';
  card.innerHTML = `
    <a href="product.html?handle=${encodeURIComponent(handle)}" class="product-img" style="display:block;text-decoration:none;">
      ${imgSrc
        ? '<img src="' + encodeURI(imgSrc) + '" alt="' + escapeHTML(product.title) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:16px 16px 0 0;" />'
        : '<div class="product-img-placeholder" style="background: linear-gradient(180deg, #E8E4F0 0%, #B8A5D4 100%);"></div>'}
      ${tagLabel ? '<span class="product-tag">' + escapeHTML(tagLabel) + '</span>' : ''}
    </a>
    <div class="product-info">
      <a href="product.html?handle=${encodeURIComponent(handle)}" class="product-name" style="text-decoration:none;color:inherit;display:block;">${escapeHTML(product.title)}</a>
      <p class="product-desc">${escapeHTML((product.description || '').substring(0, 60))}</p>
      <div class="sub-toggle">
        <button class="sub-toggle-btn active" onclick="setMode(this,'once')">Achat unique</button>
        <button class="sub-toggle-btn sub-option" onclick="setMode(this,'sub')">Abonnement -10%</button>
      </div>
      <div class="sub-freq" style="display:none">
        <button class="sub-freq-btn active" data-freq="2" onclick="setFreq(this,'2')">Tous les 2 mois</button>
        <button class="sub-freq-btn" data-freq="4" onclick="setFreq(this,'4')">Tous les 4 mois</button>
      </div>
      <div class="sub-discount" style="display:none">\u00c9conomisez ${saving}\u20ac par livraison</div>
      <div class="product-bottom">
        <div class="product-price">${price} &euro;</div>
        <button class="add-to-cart-btn ripple-btn" onclick="addToCartStatic(this)">+</button>
      </div>
    </div>`;
  return card;
}

function updateProductsFromShopify(products) {
  allShopifyProducts = products;

  // --- BEST-SELLERS: Top 3 only ---
  const bsGrid = document.getElementById('bestsellersGrid');
  if (bsGrid) {
    while (bsGrid.firstChild) bsGrid.removeChild(bsGrid.firstChild);
    const top3 = products.slice(0, 3);
    const bsLabels = ['Best-seller', 'Populaire', 'Top vente'];
    top3.forEach((product, i) => {
      const card = buildProductCard(product, i, bsLabels[i] || '');
      bsGrid.appendChild(card);
    });
  }

  // --- CATALOGUE: All products ---
  const catGrid = document.getElementById('catalogueGrid');
  if (catGrid) {
    while (catGrid.firstChild) catGrid.removeChild(catGrid.firstChild);
    products.forEach((product, i) => {
      const tags = product.tags || [];
      let tagLabel = '';
      if (tags.includes('new') || tags.includes('nouveau')) tagLabel = 'Nouveau';
      const card = buildProductCard(product, i, tagLabel);
      catGrid.appendChild(card);
    });
  }

  // Also update legacy carousel if exists
  const carousel = document.getElementById('productsCarousel');
  if (carousel) {
    while (carousel.firstChild) carousel.removeChild(carousel.firstChild);
    products.forEach((product, i) => {
      const tags = product.tags || [];
      let tagLabel = '';
      if (i === 0) tagLabel = 'Best-seller';
      else if (tags.includes('new') || tags.includes('nouveau')) tagLabel = 'Nouveau';
      const card = buildProductCard(product, i, tagLabel);
      carousel.appendChild(card);
    });
  }
}

async function addToCart(variantId, title, price, imgSrc) {
  // Show toast
  showToast();

  if (shopifyClient && shopifyCheckout) {
    try {
      shopifyCheckout = await shopifyClient.checkout.addLineItems(shopifyCheckout.id, [{
        variantId: variantId,
        quantity: 1
      }]);
      syncCartFromCheckout();
    } catch (err) {
      console.warn('Add to cart error:', err);
      addToCartLocal(title, price, imgSrc);
    }
  } else {
    addToCartLocal(title, price, imgSrc);
  }
}

function addToCartLocal(title, price, imgSrc) {
  const existing = cartItemsData.find(item => item.title === title);
  if (existing) {
    existing.qty += 1;
  } else {
    cartItemsData.push({ title, price, imgSrc, qty: 1 });
  }
  renderCart();
}

function syncCartFromCheckout() {
  if (!shopifyCheckout) return;
  cartItemsData = shopifyCheckout.lineItems.map(item => ({
    id: item.id,
    title: item.title,
    price: parseFloat(item.variant.price.amount || item.variant.price).toFixed(2).replace('.', ','),
    imgSrc: item.variant.image ? item.variant.image.src : '',
    qty: item.quantity,
    variantId: item.variant.id
  }));
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cartItems');
  const footer = document.getElementById('cartFooter');
  const badge = document.getElementById('cartBadge');
  const totalEl = document.getElementById('cartTotal');

  if (cartItemsData.length === 0) {
    while (container.firstChild) container.removeChild(container.firstChild);
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'cart-empty';
    emptyMsg.textContent = 'Votre panier est vide';
    container.appendChild(emptyMsg);
    footer.style.display = 'none';
    if (badge) badge.classList.remove('show');
    return;
  }

  let html = '';
  let total = 0;
  let totalQty = 0;

  cartItemsData.forEach((item, i) => {
    const itemTotal = parseFloat(item.price.replace(',', '.')) * item.qty;
    total += itemTotal;
    totalQty += item.qty;
    html += `
      <div class="cart-item">
        <div class="cart-item-img" style="background-image:url('${encodeURI(item.imgSrc)}');"></div>
        <div class="cart-item-details">
          <div class="cart-item-name">${escapeHTML(item.title)}</div>
          <div class="cart-item-price">${escapeHTML(item.price)}&euro;</div>
          <div class="cart-item-qty">
            <button onclick="updateQty(${i}, -1)">&minus;</button>
            <span>${item.qty}</span>
            <button onclick="updateQty(${i}, 1)">+</button>
          </div>
        </div>
        <button class="cart-item-remove" onclick="removeItem(${i})">&times;</button>
      </div>`;
  });

  container.innerHTML = html;
  footer.style.display = 'block';
  totalEl.textContent = total.toFixed(2).replace('.', ',') + '\u20AC';
  if (badge) {
    badge.textContent = totalQty;
    badge.classList.add('show');
  }
}

async function updateQty(index, delta) {
  if (shopifyCheckout && cartItemsData[index].id) {
    const item = cartItemsData[index];
    const newQty = item.qty + delta;
    if (newQty <= 0) {
      shopifyCheckout = await shopifyClient.checkout.removeLineItems(shopifyCheckout.id, [item.id]);
    } else {
      shopifyCheckout = await shopifyClient.checkout.updateLineItems(shopifyCheckout.id, [{
        id: item.id, quantity: newQty
      }]);
    }
    syncCartFromCheckout();
  } else {
    cartItemsData[index].qty += delta;
    if (cartItemsData[index].qty <= 0) cartItemsData.splice(index, 1);
    renderCart();
  }
}

async function removeItem(index) {
  if (shopifyCheckout && cartItemsData[index].id) {
    shopifyCheckout = await shopifyClient.checkout.removeLineItems(shopifyCheckout.id, [cartItemsData[index].id]);
    syncCartFromCheckout();
  } else {
    cartItemsData.splice(index, 1);
    renderCart();
  }
}

function toggleCart() {
  document.getElementById('cartDrawer').classList.toggle('open');
  document.getElementById('cartOverlay').classList.toggle('open');
}

function goToCheckout() {
  if (shopifyCheckout && shopifyCheckout.webUrl) {
    window.open(shopifyCheckout.webUrl, '_blank');
  } else {
    alert('Redirection vers le checkout Shopify...');
  }
}

function showToast() {
  const toast = document.getElementById('cartToast');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// Static product fallback (when SDK hasn't replaced products)
function addToCartStatic(btn) {
  const card = btn.closest('.product-card');
  const title = card.querySelector('.product-name').textContent;
  const basePrice = card.getAttribute('data-base-price');
  const subToggle = card.querySelector('.sub-toggle');
  let finalPrice = basePrice ? basePrice : card.querySelector('.product-price').textContent.match(/[\d,]+/)[0];
  let suffix = '';
  if (subToggle) {
    const subBtn = subToggle.querySelector('.sub-option');
    if (subBtn && subBtn.classList.contains('active')) {
      const numPrice = parseFloat(finalPrice.replace(',', '.'));
      finalPrice = (numPrice * 0.9).toFixed(2).replace('.', ',');
      const freqBtn = card.querySelector('.sub-freq-btn.active');
      const months = freqBtn ? freqBtn.getAttribute('data-freq') : '2';
      suffix = ' (Abo ' + months + ' mois)';
    }
  }
  addToCartLocal(title + suffix, finalPrice, '');
  showToast();
}

// ============ SUBSCRIPTION TOGGLE ============
function setMode(btn, mode) {
  const card = btn.closest('.product-card');
  const toggleBtns = card.querySelectorAll('.sub-toggle-btn');
  const freqDiv = card.querySelector('.sub-freq');
  const discountDiv = card.querySelector('.sub-discount');
  const priceEl = card.querySelector('.product-price');
  const basePrice = parseFloat(card.getAttribute('data-base-price').replace(',', '.'));

  toggleBtns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  if (mode === 'sub') {
    freqDiv.style.display = 'flex';
    discountDiv.style.display = 'block';
    const discounted = (basePrice * 0.9).toFixed(2).replace('.', ',');
    const saving = (basePrice * 0.1).toFixed(2).replace('.', ',');
    while (priceEl.firstChild) priceEl.removeChild(priceEl.firstChild);
    const oldPriceSpan = document.createElement('span');
    oldPriceSpan.style.cssText = 'text-decoration:line-through;opacity:.5;font-size:.85em;margin-right:6px';
    oldPriceSpan.textContent = basePrice.toFixed(2).replace('.', ',') + ' €';
    priceEl.appendChild(oldPriceSpan);
    priceEl.appendChild(document.createTextNode(discounted + ' €'));
    discountDiv.textContent = 'Économisez ' + saving + ' € par livraison';
  } else {
    freqDiv.style.display = 'none';
    discountDiv.style.display = 'none';
    priceEl.textContent = basePrice.toFixed(2).replace('.', ',') + ' €';
  }
}

function setFreq(btn, months) {
  const card = btn.closest('.product-card');
  const freqBtns = card.querySelectorAll('.sub-freq-btn');
  freqBtns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ============ PRODUCT DETAIL PAGE ============
async function loadSingleProduct(handle) {
  const container = document.getElementById('productDetailContainer');
  if (!container) return;

  // Show loading
  container.innerHTML = '<div class="product-loading"><div class="spinner"></div><p>Chargement du produit...</p></div>';

  if (typeof ShopifyBuy === 'undefined') {
    container.innerHTML = '<div class="product-not-found"><h2>Erreur de chargement</h2><p>Impossible de se connecter &agrave; la boutique.</p><a href="index.html">Retour &agrave; l\'accueil</a></div>';
    return;
  }

  try {
    if (!shopifyClient) {
      shopifyClient = ShopifyBuy.buildClient({
        domain: SHOPIFY_DOMAIN,
        storefrontAccessToken: STOREFRONT_TOKEN,
      });
      shopifyCheckout = await shopifyClient.checkout.create();
    }

    const product = await shopifyClient.product.fetchByHandle(handle);
    if (!product) {
      container.innerHTML = '<div class="product-not-found"><h2>Produit introuvable</h2><p>Ce produit n\'existe pas ou n\'est plus disponible.</p><a href="index.html">&larr; Retour &agrave; l\'accueil</a></div>';
      return;
    }

    const variant = product.variants[0];
    const price = parseFloat(variant.price.amount || variant.price).toFixed(2).replace('.', ',');
    const saving = (parseFloat(price.replace(',', '.')) * 0.1).toFixed(2).replace('.', ',');
    const images = product.images || [];
    const mainImg = images[0] ? images[0].src : '';
    const pType = (product.productType || '').replace(/^\w/, c => c.toUpperCase());

    // Build breadcrumb
    const breadcrumb = document.getElementById('productBreadcrumb');
    if (breadcrumb) {
      breadcrumb.innerHTML = '<a href="index.html">Accueil</a><span>&rsaquo;</span><a href="index.html#catalogue">Catalogue</a><span>&rsaquo;</span>' + escapeHTML(product.title);
    }
    const breadcrumbCurrent = document.getElementById('breadcrumbProduct');
    if (breadcrumbCurrent) {
      breadcrumbCurrent.textContent = product.title;
    }
    // Update page title
    document.title = product.title + ' — Pro Pure';

    // Build gallery
    let thumbsHtml = '';
    if (images.length > 1) {
      images.forEach((img, i) => {
        thumbsHtml += '<div class="product-gallery-thumb' + (i === 0 ? ' active' : '') + '" onclick="changeMainImage(this, \'' + encodeURI(img.src) + '\')">'
          + '<img src="' + encodeURI(img.src) + '" alt="' + escapeHTML(product.title) + ' ' + (i+1) + '" loading="lazy" />'
          + '</div>';
      });
    }

    // Build detail HTML
    container.innerHTML = `
      <div class="product-detail">
        <div class="product-gallery">
          <div class="product-gallery-main">
            <img id="mainProductImage" src="${encodeURI(mainImg)}" alt="${escapeHTML(product.title)}" />
          </div>
          ${thumbsHtml ? '<div class="product-gallery-thumbs">' + thumbsHtml + '</div>' : ''}
        </div>
        <div class="product-info">
          ${pType ? '<div class="product-category">' + escapeHTML(pType) + '</div>' : ''}
          <h1 class="product-title">${escapeHTML(product.title)}</h1>
          <div class="product-price-detail">${price} &euro;</div>
          <div class="product-description-full">${escapeHTML(product.description || 'Un produit d\'exception de la gamme Pro Pure.')}</div>
          <div class="product-card" data-base-price="${price}" style="background:none;box-shadow:none;padding:0;">
            <span class="product-name" style="display:none">${escapeHTML(product.title)}</span>
            <div class="sub-toggle">
              <button class="sub-toggle-btn active" onclick="setMode(this,'once')">Achat unique</button>
              <button class="sub-toggle-btn sub-option" onclick="setMode(this,'sub')">Abonnement -10%</button>
            </div>
            <div class="sub-freq" style="display:none">
              <button class="sub-freq-btn active" data-freq="2" onclick="setFreq(this,'2')">Tous les 2 mois</button>
              <button class="sub-freq-btn" data-freq="4" onclick="setFreq(this,'4')">Tous les 4 mois</button>
            </div>
            <div class="sub-discount" style="display:none">&Eacute;conomisez ${saving}&euro; par livraison</div>
            <div class="product-bottom" style="margin-top:1rem;">
              <div class="product-price" style="font-size:1.3rem;">${price} &euro;</div>
            </div>
            <div class="product-actions" style="margin-top:1.5rem;">
              <button class="product-add-btn add-to-cart-btn ripple-btn" onclick="addToCartStatic(this)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
                Ajouter au panier
              </button>
            </div>
          </div>
          <div class="product-meta">
            <div class="product-meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              Livraison rapide en 48h
            </div>
            <div class="product-meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Formule professionnelle
            </div>
            <div class="product-meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Fabriqu&eacute; en France
            </div>
          </div>
        </div>
      </div>`;

    // Load related products
    loadRelatedProducts(product);

  } catch (err) {
    console.error('Error loading product:', err);
    container.innerHTML = '<div class="product-not-found"><h2>Erreur</h2><p>Une erreur est survenue lors du chargement.</p><a href="index.html">&larr; Retour &agrave; l\'accueil</a></div>';
  }
}

function changeMainImage(thumb, src) {
  document.getElementById('mainProductImage').src = src;
  document.querySelectorAll('.product-gallery-thumb').forEach(t => t.classList.remove('active'));
  thumb.classList.add('active');
}

async function loadRelatedProducts(currentProduct) {
  const container = document.getElementById('relatedProducts');
  if (!container) return;

  try {
    const allProducts = await shopifyClient.product.fetchAll(20);
    const related = allProducts
      .filter(p => p.id !== currentProduct.id)
      .filter(p => {
        const sameType = p.productType === currentProduct.productType;
        return sameType;
      })
      .slice(0, 4);

    if (related.length === 0) {
      // If no same-type products, show random ones
      const random = allProducts.filter(p => p.id !== currentProduct.id).slice(0, 4);
      if (random.length === 0) { container.parentElement.style.display = 'none'; return; }
      renderRelatedGrid(container, random);
    } else {
      renderRelatedGrid(container, related);
    }
  } catch (err) {
    console.warn('Could not load related products:', err);
    container.parentElement.style.display = 'none';
  }
}

function renderRelatedGrid(container, products) {
  container.innerHTML = '';
  products.forEach((product, i) => {
    const variant = product.variants[0];
    const price = parseFloat(variant.price.amount || variant.price).toFixed(2).replace('.', ',');
    const imgSrc = product.images[0] ? product.images[0].src : '';
    const handle = product.handle || '';

    const card = document.createElement('a');
    card.href = 'product.html?handle=' + encodeURIComponent(handle);
    card.className = 'product-card-link';
    card.innerHTML = `
      <div class="product-card reveal visible" data-base-price="${price}">
        <div class="product-img">
          ${imgSrc
            ? '<img src="' + encodeURI(imgSrc) + '" alt="' + escapeHTML(product.title) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:16px 16px 0 0;" />'
            : '<div class="product-img-placeholder"></div>'}
        </div>
        <div class="product-info">
          <h3 class="product-name">${escapeHTML(product.title)}</h3>
          <div class="product-bottom">
            <div class="product-price">${price} &euro;</div>
          </div>
        </div>
      </div>`;
    container.appendChild(card);
  });
}

// Init Shopify on load
window.addEventListener('DOMContentLoaded', function() {
  // Check if we're on the product detail page
  const urlParams = new URLSearchParams(window.location.search);
  const handle = urlParams.get('handle');
  if (handle && document.getElementById('productDetailContainer')) {
    loadSingleProduct(handle);
  } else {
    initShopify();
  }
});
