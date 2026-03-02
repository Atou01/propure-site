// ============ SHOPIFY STOREFRONT API ============
const SHOPIFY_DOMAIN = '2gchuh-tt.myshopify.com';
const STOREFRONT_TOKEN = '53cac02ce08a74431eac8f362fc82686';
const STOREFRONT_API_VERSION = '2024-10';

let shopifyClient; // Keep SDK for product fetching only

// --- Selling Plans (from Seal Subscriptions) ---
// These are fetched dynamically at init, with fallback to known IDs
let sellingPlanMap = {
  '2': 'gid://shopify/SellingPlan/692066156877',  // 2 months, -15%
  '4': 'gid://shopify/SellingPlan/692066189645'   // 4 months, -10%
};

// --- Cart State (GraphQL Cart API) ---
let cartId = null;
let cartCheckoutUrl = null;
let cartItemsData = [];

// --- Cart Persistence ---
function saveCartId() {
  if (cartId) {
    localStorage.setItem('propure_cartId', cartId);
  }
}
function getSavedCartId() {
  return localStorage.getItem('propure_cartId');
}
function clearSavedCart() {
  localStorage.removeItem('propure_cartId');
}

async function restoreCart(savedId) {
  var query = 'query getCart($cartId: ID!) { cart(id: $cartId) { ...CartFields } } ' + CART_FRAGMENT;
  var result = await storefrontFetch(query, { cartId: savedId });
  if (result.data && result.data.cart && result.data.cart.id) {
    var cart = result.data.cart;
    cartId = cart.id;
    cartCheckoutUrl = cart.checkoutUrl;
    syncCartFromGraphQL(cart);
    return cart;
  }
  return null;
}

// --- Security: HTML escape utility ---
function escapeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ============ STOREFRONT API GRAPHQL HELPER ============
async function storefrontFetch(query, variables) {
  const response = await fetch(
    'https://' + SHOPIFY_DOMAIN + '/api/' + STOREFRONT_API_VERSION + '/graphql.json',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query: query, variables: variables || {} }),
    }
  );
  if (!response.ok) {
    throw new Error('Storefront API HTTP error: ' + response.status);
  }
  var data = await response.json();
  return data;
}

// ============ CART GRAPHQL FRAGMENTS ============
const CART_FRAGMENT = `
  fragment CartFields on Cart {
    id
    checkoutUrl
    lines(first: 50) {
      edges {
        node {
          id
          quantity
          merchandise {
            ... on ProductVariant {
              id
              title
              price { amount currencyCode }
              image { url altText }
              product { title handle }
            }
          }
          sellingPlanAllocation {
            sellingPlan { id name }
            priceAdjustments {
              price { amount currencyCode }
              compareAtPrice { amount currencyCode }
            }
          }
          attributes { key value }
          cost {
            totalAmount { amount currencyCode }
            subtotalAmount { amount currencyCode }
          }
        }
      }
    }
    cost {
      totalAmount { amount currencyCode }
      subtotalAmount { amount currencyCode }
    }
  }
`;

// ============ CART OPERATIONS ============
async function createCart(lines) {
  const mutation = `
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart { ...CartFields }
        userErrors { field message }
      }
    }
    ${CART_FRAGMENT}
  `;
  const result = await storefrontFetch(mutation, { input: { lines: lines || [] } });
  if (result.data && result.data.cartCreate && result.data.cartCreate.cart) {
    const cart = result.data.cartCreate.cart;
    cartId = cart.id;
    cartCheckoutUrl = cart.checkoutUrl;
    saveCartId();
    syncCartFromGraphQL(cart);
    return cart;
  }
  return null;
}

async function cartLinesAdd(lines) {
  if (!cartId) {
    return createCart(lines);
  }
  const mutation = `
    mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart { ...CartFields }
        userErrors { field message }
      }
    }
    ${CART_FRAGMENT}
  `;
  const result = await storefrontFetch(mutation, { cartId: cartId, lines: lines });
  if (result.data && result.data.cartLinesAdd && result.data.cartLinesAdd.cart) {
    const cart = result.data.cartLinesAdd.cart;
    cartCheckoutUrl = cart.checkoutUrl;
    syncCartFromGraphQL(cart);
    return cart;
  }
  return null;
}

async function cartLinesUpdate(linesUpdate) {
  if (!cartId) return null;
  const mutation = `
    mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart { ...CartFields }
        userErrors { field message }
      }
    }
    ${CART_FRAGMENT}
  `;
  const result = await storefrontFetch(mutation, { cartId: cartId, lines: linesUpdate });
  if (result.data && result.data.cartLinesUpdate && result.data.cartLinesUpdate.cart) {
    const cart = result.data.cartLinesUpdate.cart;
    cartCheckoutUrl = cart.checkoutUrl;
    syncCartFromGraphQL(cart);
    return cart;
  }
  return null;
}

async function cartLinesRemove(lineIds) {
  if (!cartId) return null;
  const mutation = `
    mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart { ...CartFields }
        userErrors { field message }
      }
    }
    ${CART_FRAGMENT}
  `;
  const result = await storefrontFetch(mutation, { cartId: cartId, lineIds: lineIds });
  if (result.data && result.data.cartLinesRemove && result.data.cartLinesRemove.cart) {
    const cart = result.data.cartLinesRemove.cart;
    cartCheckoutUrl = cart.checkoutUrl;
    syncCartFromGraphQL(cart);
    return cart;
  }
  return null;
}

// ============ INIT ============
async function initShopify() {
  if (typeof ShopifyBuy === 'undefined') {
    return;
  }
  try {
    // Init SDK for product fetching only
    shopifyClient = ShopifyBuy.buildClient({
      domain: SHOPIFY_DOMAIN,
      storefrontAccessToken: STOREFRONT_TOKEN,
    });

    // Restore cart from localStorage or create new one
    var savedId = getSavedCartId();
    var restored = false;
    if (savedId) {
      try {
        var cart = await restoreCart(savedId);
        if (cart) restored = true;
      } catch (e) {
        clearSavedCart();
      }
    }
    if (!restored) {
      await createCart([]);
    }

    // Fetch selling plans to confirm IDs
    await fetchSellingPlans();

    // Fetch products and update UI
    const products = await shopifyClient.product.fetchAll(50);
    if (products.length > 0) {
      updateProductsFromShopify(products);
    }
  } catch (err) {
    // Shopify init failed — static fallback active
  }
}

async function fetchSellingPlans() {
  try {
    const result = await storefrontFetch(`{
      products(first: 1) {
        edges {
          node {
            sellingPlanGroups(first: 1) {
              edges {
                node {
                  sellingPlans(first: 10) {
                    edges {
                      node {
                        id
                        name
                        options { name value }
                        priceAdjustments {
                          adjustmentValue {
                            ... on SellingPlanPercentagePriceAdjustment { adjustmentPercentage }
                          }
                          orderCount
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`);

    const productNode = result.data.products.edges[0];
    if (productNode) {
      const groups = productNode.node.sellingPlanGroups.edges;
      if (groups.length > 0) {
        const plans = groups[0].node.sellingPlans.edges;
        plans.forEach(function(planEdge) {
          var plan = planEdge.node;
          var option = plan.options[0];
          if (option && option.value) {
            // Extract month number from option value like "2 months"
            var monthMatch = option.value.match(/(\d+)/);
            if (monthMatch) {
              sellingPlanMap[monthMatch[1]] = plan.id;
            }
          }
        });
      }
    }
  } catch (err) {
    // Using fallback selling plan IDs
  }
}

// ============ PRODUCT CARDS ============
let allShopifyProducts = [];

function buildProductCard(product, i, tagLabel) {
  var variant = product.variants[0];
  var price = parseFloat(variant.price.amount || variant.price).toFixed(2).replace('.', ',');
  var imgSrc = product.images[0] ? product.images[0].src : '';
  var defaultDiscount = 0.15;
  var saving = (parseFloat(price.replace(',', '.')) * defaultDiscount).toFixed(2).replace('.', ',');
  var inStock = product.availableForSale !== false;

  var card = document.createElement('div');
  card.className = 'product-card reveal visible';
  card.setAttribute('data-base-price', price);
  card.setAttribute('data-variant-id', variant.id);
  var pType = (product.productType || '').toLowerCase();
  card.setAttribute('data-product-type', pType);
  var tags = product.tags || [];
  card.setAttribute('data-tags', tags.join(',').toLowerCase());

  var handle = product.handle || '';
  card.innerHTML = '<a href="product.html?handle=' + encodeURIComponent(handle) + '" class="product-img" style="display:block;text-decoration:none;">'
    + (imgSrc
      ? '<img src="' + encodeURI(imgSrc) + '" alt="' + escapeHTML(product.title) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:16px 16px 0 0;" />'
      : '<div class="product-img-placeholder" style="background: linear-gradient(180deg, #E8E4F0 0%, #B8A5D4 100%);"></div>')
    + (tagLabel ? '<span class="product-tag">' + escapeHTML(tagLabel) + '</span>' : '')
    + '</a>'
    + '<div class="product-info">'
    + '<a href="product.html?handle=' + encodeURIComponent(handle) + '" class="product-name" style="text-decoration:none;color:inherit;display:block;">' + escapeHTML(product.title) + '</a>'
    + '<p class="product-desc">' + escapeHTML((product.description || '').substring(0, 60)) + '</p>'
    + '<div class="sub-toggle">'
    + '<button class="sub-toggle-btn active" onclick="setMode(this,\'once\')">Achat unique</button>'
    + '<button class="sub-toggle-btn sub-option" onclick="setMode(this,\'sub\')">Abonnement -15%</button>'
    + '</div>'
    + '<div class="sub-freq" style="display:none">'
    + '<button class="sub-freq-btn active" data-freq="2" data-discount="15" onclick="setFreq(this,\'2\')">Tous les 2 mois (-15%)</button>'
    + '<button class="sub-freq-btn" data-freq="4" data-discount="10" onclick="setFreq(this,\'4\')">Tous les 4 mois (-10%)</button>'
    + '</div>'
    + '<div class="sub-discount" style="display:none">\u00c9conomisez ' + saving + '\u20ac par livraison</div>'
    + '<div class="product-bottom">'
    + '<div class="product-price">' + price + ' &euro;</div>'
    + (inStock
      ? '<button class="add-to-cart-btn ripple-btn" onclick="addToCartStatic(this)" aria-label="Ajouter ' + escapeHTML(product.title) + ' au panier">+</button>'
      : '<span class="out-of-stock-label">Rupture</span>')
    + '</div>'
    + '</div>';
  if (!inStock) card.classList.add('out-of-stock');
  return card;
}

function updateProductsFromShopify(products) {
  allShopifyProducts = products;

  // --- BEST-SELLERS: Top 3 only ---
  var bsGrid = document.getElementById('bestsellersGrid');
  if (bsGrid) {
    while (bsGrid.firstChild) bsGrid.removeChild(bsGrid.firstChild);
    var top3 = products.slice(0, 3);
    var bsLabels = ['Best-seller', 'Populaire', 'Top vente'];
    top3.forEach(function(product, i) {
      var card = buildProductCard(product, i, bsLabels[i] || '');
      bsGrid.appendChild(card);
    });
  }

  // --- CATALOGUE: All products ---
  var catGrid = document.getElementById('catalogueGrid');
  if (catGrid) {
    while (catGrid.firstChild) catGrid.removeChild(catGrid.firstChild);
    products.forEach(function(product, i) {
      var tags = product.tags || [];
      var tagLabel = '';
      if (tags.includes('new') || tags.includes('nouveau')) tagLabel = 'Nouveau';
      var card = buildProductCard(product, i, tagLabel);
      catGrid.appendChild(card);
    });
  }

  // Hide loading skeleton
  var skeleton = document.getElementById('catalogueSkeleton');
  if (skeleton) skeleton.style.display = 'none';

  // Also update legacy carousel if exists
  var carousel = document.getElementById('productsCarousel');
  if (carousel) {
    while (carousel.firstChild) carousel.removeChild(carousel.firstChild);
    products.forEach(function(product, i) {
      var tags = product.tags || [];
      var tagLabel = '';
      if (i === 0) tagLabel = 'Best-seller';
      else if (tags.includes('new') || tags.includes('nouveau')) tagLabel = 'Nouveau';
      var card = buildProductCard(product, i, tagLabel);
      carousel.appendChild(card);
    });
  }
}

// ============ QUANTITY SELECTOR (product detail page) ============
function changeDetailQty(btn, delta) {
  var selector = btn.closest('.qty-selector');
  var qtyEl = selector.querySelector('span');
  var current = parseInt(qtyEl.textContent) || 1;
  var newQty = Math.max(1, Math.min(10, current + delta));
  qtyEl.textContent = newQty;
  selector.setAttribute('data-qty', newQty);
}

// ============ ADD TO CART ============
async function addToCart(variantId, title, price, imgSrc, subscriptionInfo, qty) {
  // Show toast + auto-open cart
  showToast();
  setTimeout(function() {
    var drawer = document.getElementById('cartDrawer');
    if (drawer && !drawer.classList.contains('open')) toggleCart();
  }, 400);

  try {
    var line = {
      merchandiseId: variantId,
      quantity: qty || 1
    };

    // If subscription, attach selling plan ID
    if (subscriptionInfo && subscriptionInfo.frequency) {
      var planId = sellingPlanMap[subscriptionInfo.frequency];
      if (planId) {
        line.sellingPlanId = planId;
      }
      // Also add custom attributes for display purposes
      var discountPct = subscriptionInfo.frequency === '2' ? '15' : '10';
      line.attributes = [
        { key: 'Mode', value: 'Abonnement' },
        { key: 'Fr\u00e9quence', value: 'Tous les ' + subscriptionInfo.frequency + ' mois' },
        { key: 'R\u00e9duction', value: '-' + discountPct + '%' }
      ];
    }

    // Add to cart via GraphQL
    await cartLinesAdd([line]);

  } catch (err) {
    addToCartLocal(title, price, imgSrc);
  }
}

function addToCartLocal(title, price, imgSrc) {
  var existingIndex = cartItemsData.findIndex(function(item) { return item.title === title; });
  if (existingIndex >= 0) {
    cartItemsData = cartItemsData.map(function(item, i) {
      if (i === existingIndex) return { title: item.title, price: item.price, imgSrc: item.imgSrc, qty: item.qty + 1 };
      return item;
    });
  } else {
    cartItemsData = cartItemsData.concat([{ title: title, price: price, imgSrc: imgSrc, qty: 1 }]);
  }
  renderCart();
}

// ============ SYNC CART FROM GRAPHQL ============
function syncCartFromGraphQL(cart) {
  if (!cart || !cart.lines) return;
  cartItemsData = cart.lines.edges.map(function(edge) {
    var node = edge.node;
    var merch = node.merchandise;
    var productTitle = merch.product ? merch.product.title : merch.title;

    // Check for selling plan allocation (subscription)
    var isSubscription = !!node.sellingPlanAllocation;
    var displayTitle = productTitle;
    var displayPrice;

    if (isSubscription) {
      var planName = node.sellingPlanAllocation.sellingPlan.name;
      displayTitle = productTitle + ' (Abo - ' + planName + ')';
      // Use the discounted price from selling plan
      var adj = node.sellingPlanAllocation.priceAdjustments[0];
      displayPrice = parseFloat(adj.price.amount).toFixed(2).replace('.', ',');
    } else {
      displayPrice = parseFloat(merch.price.amount).toFixed(2).replace('.', ',');
    }

    return {
      id: node.id,
      title: displayTitle,
      price: displayPrice,
      imgSrc: merch.image ? merch.image.url : '',
      qty: node.quantity,
      variantId: merch.id
    };
  });
  renderCart();
}

// ============ RENDER CART ============
function renderCart() {
  var container = document.getElementById('cartItems');
  var footer = document.getElementById('cartFooter');
  var badge = document.getElementById('cartBadge');
  var totalEl = document.getElementById('cartTotal');

  if (cartItemsData.length === 0) {
    while (container.firstChild) container.removeChild(container.firstChild);
    var emptyMsg = document.createElement('p');
    emptyMsg.className = 'cart-empty';
    emptyMsg.textContent = 'Votre panier est vide';
    container.appendChild(emptyMsg);
    footer.style.display = 'none';
    if (badge) badge.classList.remove('show');
    return;
  }

  while (container.firstChild) container.removeChild(container.firstChild);
  var total = 0;
  var totalQty = 0;

  cartItemsData.forEach(function(item, i) {
    var itemTotal = parseFloat(item.price.replace(',', '.')) * item.qty;
    total += itemTotal;
    totalQty += item.qty;

    var row = document.createElement('div');
    row.className = 'cart-item';

    var imgDiv = document.createElement('div');
    imgDiv.className = 'cart-item-img';
    imgDiv.style.backgroundImage = 'url(\'' + encodeURI(item.imgSrc) + '\')';
    row.appendChild(imgDiv);

    var details = document.createElement('div');
    details.className = 'cart-item-details';

    var nameDiv = document.createElement('div');
    nameDiv.className = 'cart-item-name';
    nameDiv.textContent = item.title;
    details.appendChild(nameDiv);

    var priceDiv = document.createElement('div');
    priceDiv.className = 'cart-item-price';
    priceDiv.textContent = item.price + '\u20ac';
    details.appendChild(priceDiv);

    var qtyDiv = document.createElement('div');
    qtyDiv.className = 'cart-item-qty';
    var minusBtn = document.createElement('button');
    minusBtn.innerHTML = '&minus;';
    minusBtn.setAttribute('aria-label', 'Diminuer la quantit\u00e9');
    minusBtn.addEventListener('click', (function(idx) { return function() { updateQty(idx, -1); }; })(i));
    var qtySpan = document.createElement('span');
    qtySpan.textContent = item.qty;
    var plusBtn = document.createElement('button');
    plusBtn.textContent = '+';
    plusBtn.setAttribute('aria-label', 'Augmenter la quantit\u00e9');
    plusBtn.addEventListener('click', (function(idx) { return function() { updateQty(idx, 1); }; })(i));
    qtyDiv.appendChild(minusBtn);
    qtyDiv.appendChild(qtySpan);
    qtyDiv.appendChild(plusBtn);
    details.appendChild(qtyDiv);

    row.appendChild(details);

    var removeBtn = document.createElement('button');
    removeBtn.className = 'cart-item-remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.setAttribute('aria-label', 'Retirer du panier');
    removeBtn.addEventListener('click', (function(idx) { return function() { removeItem(idx); }; })(i));
    row.appendChild(removeBtn);

    container.appendChild(row);
  });
  footer.style.display = 'block';
  totalEl.textContent = total.toFixed(2).replace('.', ',') + '\u20AC';
  if (badge) {
    badge.textContent = totalQty;
    badge.classList.add('show');
  }
}

// ============ CART ACTIONS ============
async function updateQty(index, delta) {
  var item = cartItemsData[index];
  if (cartId && item.id) {
    var newQty = item.qty + delta;
    if (newQty <= 0) {
      await cartLinesRemove([item.id]);
    } else {
      await cartLinesUpdate([{ id: item.id, quantity: newQty }]);
    }
  } else {
    cartItemsData[index].qty += delta;
    if (cartItemsData[index].qty <= 0) cartItemsData.splice(index, 1);
    renderCart();
  }
}

async function removeItem(index) {
  var item = cartItemsData[index];
  if (cartId && item.id) {
    await cartLinesRemove([item.id]);
  } else {
    cartItemsData.splice(index, 1);
    renderCart();
  }
}

function toggleCart() {
  document.getElementById('cartDrawer').classList.toggle('open');
  var overlay = document.getElementById('cartOverlay');
  if (overlay) overlay.classList.toggle('open');
  document.body.classList.toggle('cart-open');
}

function goToCheckout() {
  if (cartCheckoutUrl) {
    clearSavedCart();
    window.location.href = cartCheckoutUrl;
  }
}

function showToast() {
  var toast = document.getElementById('cartToast');
  toast.classList.add('show');
  setTimeout(function() { toast.classList.remove('show'); }, 2000);
}

// ============ STATIC PRODUCT FALLBACK ============
function addToCartStatic(btn) {
  var card = btn.closest('.product-card');
  var title = card.querySelector('.product-name').textContent;
  var basePrice = card.getAttribute('data-base-price');
  var variantId = card.getAttribute('data-variant-id');
  var subToggle = card.querySelector('.sub-toggle');
  var finalPrice = basePrice ? basePrice : card.querySelector('.product-price').textContent.match(/[\d,]+/)[0];
  var suffix = '';
  var subscriptionInfo = null;

  if (subToggle) {
    var subBtn = subToggle.querySelector('.sub-option');
    if (subBtn && subBtn.classList.contains('active')) {
      var numPrice = parseFloat(finalPrice.replace(',', '.'));
      var freqBtn = card.querySelector('.sub-freq-btn.active');
      var months = freqBtn ? freqBtn.getAttribute('data-freq') : '2';
      var discountRate = months === '2' ? 0.15 : 0.10;
      finalPrice = (numPrice * (1 - discountRate)).toFixed(2).replace('.', ',');
      suffix = ' (Abo ' + months + ' mois)';
      subscriptionInfo = { frequency: months, price: finalPrice };
    }
  }

  var imgEl = card.querySelector('.product-img img');
  var imgSrc = imgEl ? imgEl.src : '';

  // Read quantity from detail page selector (if present)
  var qtySelector = card.querySelector('.qty-selector');
  var qty = qtySelector ? parseInt(qtySelector.getAttribute('data-qty')) || 1 : 1;

  // Use GraphQL cart if available
  if (variantId && cartId !== null) {
    addToCart(variantId, title + suffix, finalPrice, imgSrc, subscriptionInfo, qty);
  } else {
    addToCartLocal(title + suffix, finalPrice, imgSrc);
    showToast();
    setTimeout(function() {
      var drawer = document.getElementById('cartDrawer');
      if (drawer && !drawer.classList.contains('open')) toggleCart();
    }, 400);
  }
}

// ============ SUBSCRIPTION TOGGLE ============
function setMode(btn, mode) {
  var card = btn.closest('.product-card');
  var toggleBtns = card.querySelectorAll('.sub-toggle-btn');
  var freqDiv = card.querySelector('.sub-freq');
  var discountDiv = card.querySelector('.sub-discount');
  var savingBox = card.querySelector('.sub-saving-box');
  var explainerDiv = card.querySelector('.sub-explainer');
  var priceEl = card.querySelector('.product-price');
  var basePrice = parseFloat(card.getAttribute('data-base-price').replace(',', '.'));

  toggleBtns.forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');

  if (mode === 'sub') {
    if (freqDiv) freqDiv.style.display = '';
    if (discountDiv) discountDiv.style.display = 'block';
    if (savingBox) savingBox.style.display = '';
    if (explainerDiv) explainerDiv.style.display = '';
    var activeFreqBtn = card.querySelector('.sub-freq-btn.active');
    var months = activeFreqBtn ? activeFreqBtn.getAttribute('data-freq') : '2';
    var discountRate = months === '2' ? 0.15 : 0.10;
    var discountPct = months === '2' ? '15' : '10';
    var discounted = (basePrice * (1 - discountRate)).toFixed(2).replace('.', ',');
    var saving = (basePrice * discountRate).toFixed(2).replace('.', ',');
    var deliveriesPerYear = months === '2' ? 6 : 3;
    var annualSaving = (basePrice * discountRate * deliveriesPerYear).toFixed(0);
    while (priceEl.firstChild) priceEl.removeChild(priceEl.firstChild);
    var oldPriceSpan = document.createElement('span');
    oldPriceSpan.style.cssText = 'text-decoration:line-through;opacity:.5;font-size:.85em;margin-right:6px';
    oldPriceSpan.textContent = basePrice.toFixed(2).replace('.', ',') + ' \u20ac';
    priceEl.appendChild(oldPriceSpan);
    priceEl.appendChild(document.createTextNode(discounted + ' \u20ac'));
    if (discountDiv) discountDiv.textContent = '\u00c9conomisez ' + saving + ' \u20ac par livraison';
    // Update saving box
    var savingPerDelivery = card.querySelector('.sub-saving-per-delivery');
    if (savingPerDelivery) savingPerDelivery.innerHTML = '\u00c9conomisez <strong>' + saving + ' \u20ac</strong> par livraison';
    var annualEl = card.querySelector('#subAnnualSaving');
    if (annualEl) annualEl.textContent = annualSaving + ' \u20ac';
    var subOptionBtn = btn.closest('.sub-toggle').querySelector('.sub-option');
    if (subOptionBtn) {
      var badgeEl = subOptionBtn.querySelector('.sub-option-badge');
      if (badgeEl) {
        badgeEl.textContent = '-' + discountPct + '%';
      } else {
        subOptionBtn.textContent = 'Abonnement -' + discountPct + '%';
      }
    }
  } else {
    if (freqDiv) freqDiv.style.display = 'none';
    if (discountDiv) discountDiv.style.display = 'none';
    if (savingBox) savingBox.style.display = 'none';
    if (explainerDiv) explainerDiv.style.display = 'none';
    priceEl.textContent = basePrice.toFixed(2).replace('.', ',') + ' \u20ac';
  }
}

function setFreq(btn, months) {
  var card = btn.closest('.product-card');
  var freqBtns = card.querySelectorAll('.sub-freq-btn');
  freqBtns.forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');

  var basePrice = parseFloat(card.getAttribute('data-base-price').replace(',', '.'));
  var discountRate = months === '2' ? 0.15 : 0.10;
  var discountPct = months === '2' ? '15' : '10';
  var discounted = (basePrice * (1 - discountRate)).toFixed(2).replace('.', ',');
  var saving = (basePrice * discountRate).toFixed(2).replace('.', ',');
  var deliveriesPerYear = months === '2' ? 6 : 3;
  var annualSaving = (basePrice * discountRate * deliveriesPerYear).toFixed(0);

  var priceEl = card.querySelector('.product-price');
  var discountDiv = card.querySelector('.sub-discount');
  var subToggle = card.querySelector('.sub-toggle');

  while (priceEl.firstChild) priceEl.removeChild(priceEl.firstChild);
  var oldPriceSpan = document.createElement('span');
  oldPriceSpan.style.cssText = 'text-decoration:line-through;opacity:.5;font-size:.85em;margin-right:6px';
  oldPriceSpan.textContent = basePrice.toFixed(2).replace('.', ',') + ' \u20ac';
  priceEl.appendChild(oldPriceSpan);
  priceEl.appendChild(document.createTextNode(discounted + ' \u20ac'));

  if (discountDiv) discountDiv.textContent = '\u00c9conomisez ' + saving + ' \u20ac par livraison';

  // Update saving box
  var savingPerDelivery = card.querySelector('.sub-saving-per-delivery');
  if (savingPerDelivery) savingPerDelivery.innerHTML = '\u00c9conomisez <strong>' + saving + ' \u20ac</strong> par livraison';
  var annualEl = card.querySelector('#subAnnualSaving');
  if (annualEl) annualEl.textContent = annualSaving + ' \u20ac';

  // Update btn price display
  var subBtnPrice = card.querySelector('.sub-option .sub-btn-price');
  if (subBtnPrice) subBtnPrice.textContent = discounted + ' \u20ac';

  if (subToggle) {
    var subBtn = subToggle.querySelector('.sub-option');
    if (subBtn) {
      var badgeEl = subBtn.querySelector('.sub-option-badge');
      if (badgeEl) {
        badgeEl.textContent = '-' + discountPct + '%';
      } else {
        subBtn.textContent = 'Abonnement -' + discountPct + '%';
      }
    }
  }
}

// ============ PRODUCT DETAIL PAGE ============
async function loadSingleProduct(handle) {
  var container = document.getElementById('productDetailContainer');
  if (!container) return;

  container.innerHTML = '<div class="product-loading"><div class="spinner"></div><p>Chargement du produit...</p></div>';

  try {
    // Restore cart from localStorage or create new one
    if (!cartId) {
      var savedId = getSavedCartId();
      var restored = false;
      if (savedId) {
        try {
          var c = await restoreCart(savedId);
          if (c) restored = true;
        } catch (e) {
          clearSavedCart();
        }
      }
      if (!restored) {
        await createCart([]);
      }
    }

    // Fetch selling plans
    await fetchSellingPlans();

    // Fetch product via direct GraphQL (more reliable than SDK)
    var productResult = await storefrontFetch(
      `query getProductByHandle($handle: String!) {
        productByHandle(handle: $handle) {
          id title handle description productType availableForSale
          variants(first: 10) {
            edges { node { id title price { amount currencyCode } availableForSale } }
          }
          images(first: 10) {
            edges { node { url altText } }
          }
        }
      }`,
      { handle: handle }
    );
    var productData = productResult.data && productResult.data.productByHandle;
    if (!productData) {
      container.innerHTML = '<div class="product-not-found"><h2>Produit introuvable</h2><p>Ce produit n\'existe pas ou n\'est plus disponible.</p><a href="index.html">&larr; Retour \u00e0 l\'accueil</a></div>';
      return;
    }

    // Normalize product object to match expected structure
    var product = {
      id: productData.id,
      title: productData.title,
      handle: productData.handle,
      description: productData.description,
      productType: productData.productType,
      availableForSale: productData.availableForSale,
      variants: productData.variants.edges.map(function(e) { return e.node; }),
      images: productData.images.edges.map(function(e) { return { src: e.node.url, altText: e.node.altText }; })
    };

    var variant = product.variants[0];
    var basePrice = parseFloat(variant.price.amount);
    var price = basePrice.toFixed(2).replace('.', ',');
    var saving = (basePrice * 0.15).toFixed(2).replace('.', ',');
    var images = product.images || [];
    var mainImg = images[0] ? images[0].src : '';
    var pType = (product.productType || '').replace(/^\w/, function(c) { return c.toUpperCase(); });
    var inStock = product.availableForSale !== false;

    var breadcrumb = document.getElementById('productBreadcrumb');
    if (breadcrumb) {
      breadcrumb.innerHTML = '<a href="index.html">Accueil</a><span>&rsaquo;</span><a href="index.html#catalogue">Catalogue</a><span>&rsaquo;</span>' + escapeHTML(product.title);
    }
    var breadcrumbCurrent = document.getElementById('breadcrumbProduct');
    if (breadcrumbCurrent) {
      breadcrumbCurrent.textContent = product.title;
    }
    document.title = product.title + ' \u2014 Pro Pure';

    var thumbsHtml = '';
    if (images.length > 1) {
      images.forEach(function(img, i) {
        thumbsHtml += '<div class="product-gallery-thumb' + (i === 0 ? ' active' : '') + '" onclick="changeMainImage(this, \'' + encodeURI(img.src) + '\')">'
          + '<img src="' + encodeURI(img.src) + '" alt="' + escapeHTML(product.title) + ' ' + (i+1) + '" loading="lazy" />'
          + '</div>';
      });
    }

    container.innerHTML = '<div class="product-detail">'
      + '<div class="product-gallery">'
      + '<div class="product-gallery-main">'
      + '<img id="mainProductImage" src="' + encodeURI(mainImg) + '" alt="' + escapeHTML(product.title) + '" />'
      + '</div>'
      + (thumbsHtml ? '<div class="product-gallery-thumbs">' + thumbsHtml + '</div>' : '')
      + '</div>'
      + '<div class="product-info">'
      + (pType ? '<div class="product-category">' + escapeHTML(pType) + '</div>' : '')
      + '<h1 class="product-title">' + escapeHTML(product.title) + '</h1>'
      + '<div class="product-price-detail">' + price + ' &euro;</div>'
      + '<div class="product-description-full">' + escapeHTML(product.description || 'Un produit d\'exception de la gamme Pro Pure.') + '</div>'
      + '<div class="product-card" data-base-price="' + price + '" data-variant-id="' + variant.id + '" style="background:none;box-shadow:none;padding:0;">'
      + '<span class="product-name" style="display:none">' + escapeHTML(product.title) + '</span>'
      + '<div class="sub-section-detail">'
      + '<div class="sub-section-header">'
      + '<span class="sub-section-title">Choisissez votre formule</span>'
      + '<span class="sub-recommended-tag">Le + populaire : Abonnement</span>'
      + '</div>'
      + '<div class="sub-toggle sub-toggle-detail">'
      + '<button class="sub-toggle-btn active" onclick="setMode(this,\'once\')">'
      + '<span class="sub-btn-title">Achat unique</span>'
      + '<span class="sub-btn-price">' + price + ' \u20ac</span>'
      + '</button>'
      + '<button class="sub-toggle-btn sub-option" onclick="setMode(this,\'sub\')">'
      + '<span class="sub-btn-title">Abonnement <span class="sub-option-badge">-15%</span></span>'
      + '<span class="sub-btn-price">' + (basePrice * 0.85).toFixed(2).replace('.', ',') + ' \u20ac</span>'
      + '</button>'
      + '</div>'
      + '<div class="sub-freq" style="display:none">'
      + '<span class="sub-freq-label">Fr\u00e9quence de livraison :</span>'
      + '<div class="sub-freq-options">'
      + '<button class="sub-freq-btn active" data-freq="2" data-discount="15" onclick="setFreq(this,\'2\')">Tous les 2 mois <strong>-15%</strong></button>'
      + '<button class="sub-freq-btn" data-freq="4" data-discount="10" onclick="setFreq(this,\'4\')">Tous les 4 mois <strong>-10%</strong></button>'
      + '</div>'
      + '</div>'
      + '<div class="sub-saving-box" style="display:none">'
      + '<div class="sub-saving-per-delivery">\u00c9conomisez <strong>' + saving + ' \u20ac</strong> par livraison</div>'
      + '<div class="sub-saving-annual">Soit <strong id="subAnnualSaving">' + (basePrice * 0.15 * 6).toFixed(0) + ' \u20ac</strong> d\'\u00e9conomie par an</div>'
      + '</div>'
      + '<div class="sub-explainer" style="display:none">'
      + '<div class="sub-explainer-title">'
      + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
      + ' Comment fonctionne l\u2019abonnement ?'
      + '</div>'
      + '<div class="sub-explainer-grid">'
      + '<div class="sub-explainer-item"><span class="sub-explainer-icon">\u2795</span><strong>Recevez automatiquement</strong> votre produit \u00e0 la fr\u00e9quence choisie, sans y penser</div>'
      + '<div class="sub-explainer-item"><span class="sub-explainer-icon">\u270f\ufe0f</span><strong>100% flexible</strong> : modifiez la fr\u00e9quence, suspendez ou annulez en 1 clic depuis votre espace client</div>'
      + '<div class="sub-explainer-item"><span class="sub-explainer-icon">\ud83d\udcb0</span><strong>Prix r\u00e9duit garanti</strong> sur chaque livraison, jusqu\'\u00e0 15% d\'\u00e9conomie</div>'
      + '<div class="sub-explainer-item"><span class="sub-explainer-icon">\ud83d\ude9a</span><strong>Aucun engagement</strong> : sans dur\u00e9e minimum, arr\u00eatez quand vous voulez</div>'
      + '</div>'
      + '</div>'
      + '</div>'
      + '<div class="product-bottom" style="margin-top:1rem;">'
      + '<div class="product-price" style="font-size:1.3rem;">' + price + ' &euro;</div>'
      + '</div>'
      + (inStock
        ? '<div class="qty-selector" data-qty="1">'
          + '<button type="button" onclick="changeDetailQty(this,-1)" aria-label="Diminuer la quantit\u00e9">&minus;</button>'
          + '<span id="detailQty">1</span>'
          + '<button type="button" onclick="changeDetailQty(this,1)" aria-label="Augmenter la quantit\u00e9">+</button>'
          + '</div>'
        : '')
      + '<div class="product-actions" style="margin-top:0.5rem;">'
      + (inStock
        ? '<button class="product-add-btn add-to-cart-btn ripple-btn" onclick="addToCartStatic(this)">'
          + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>'
          + ' Ajouter au panier'
          + '</button>'
        : '<div class="out-of-stock-banner">Produit temporairement indisponible</div>')
      + '</div>'
      + '</div>'
      + '<div class="trust-badges">'
      + '<div class="trust-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg><span>Fabriqu\u00e9 en France</span></div>'
      + '<div class="trust-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg><span>Livraison 48h</span></div>'
      + '<div class="trust-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Formule Pro</span></div>'
      + '<div class="trust-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg><span>Non test\u00e9 sur animaux</span></div>'
      + '</div>'
      + '<div class="delivery-estimate" id="deliveryEstimate"></div>'
      + '</div>'
      + '</div>';

    // Calculate estimated delivery date
    updateDeliveryEstimate();

    loadRelatedProducts(product);

  } catch (err) {
    container.innerHTML = '<div class="product-not-found"><h2>Erreur</h2><p>Une erreur est survenue lors du chargement du produit.</p><a href="index.html">&larr; Retour \u00e0 l\'accueil</a></div>';
  }
}

function updateDeliveryEstimate() {
  var el = document.getElementById('deliveryEstimate');
  if (!el) return;
  var now = new Date();
  var orderHour = now.getHours();
  // If ordered before 14h, ships today; otherwise tomorrow
  var shipDate = new Date(now);
  if (orderHour >= 14) shipDate.setDate(shipDate.getDate() + 1);
  // Skip weekends for shipping
  if (shipDate.getDay() === 0) shipDate.setDate(shipDate.getDate() + 1);
  if (shipDate.getDay() === 6) shipDate.setDate(shipDate.getDate() + 2);
  // Delivery = ship date + 2 business days
  var deliveryMin = new Date(shipDate);
  deliveryMin.setDate(deliveryMin.getDate() + 1);
  if (deliveryMin.getDay() === 0) deliveryMin.setDate(deliveryMin.getDate() + 1);
  if (deliveryMin.getDay() === 6) deliveryMin.setDate(deliveryMin.getDate() + 2);
  var deliveryMax = new Date(shipDate);
  deliveryMax.setDate(deliveryMax.getDate() + 3);
  if (deliveryMax.getDay() === 0) deliveryMax.setDate(deliveryMax.getDate() + 1);
  if (deliveryMax.getDay() === 6) deliveryMax.setDate(deliveryMax.getDate() + 2);

  var jours = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  var mois = ['janvier','f\u00e9vrier','mars','avril','mai','juin','juillet','ao\u00fbt','septembre','octobre','novembre','d\u00e9cembre'];
  var minStr = jours[deliveryMin.getDay()] + ' ' + deliveryMin.getDate() + ' ' + mois[deliveryMin.getMonth()];
  var maxStr = jours[deliveryMax.getDay()] + ' ' + deliveryMax.getDate() + ' ' + mois[deliveryMax.getMonth()];

  el.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>'
    + '<span>Commandez maintenant, livr\u00e9 entre <strong>' + minStr + '</strong> et <strong>' + maxStr + '</strong></span>';
}

function changeMainImage(thumb, src) {
  document.getElementById('mainProductImage').src = src;
  document.querySelectorAll('.product-gallery-thumb').forEach(function(t) { t.classList.remove('active'); });
  thumb.classList.add('active');
}

async function loadRelatedProducts(currentProduct) {
  var section = document.getElementById('relatedProducts');
  if (!section) return;
  var grid = document.getElementById('relatedGrid');
  if (!grid) return;

  try {
    var result = await storefrontFetch(`{
      products(first: 20) {
        edges { node {
          id title handle productType availableForSale
          variants(first: 1) { edges { node { id title price { amount } } } }
          images(first: 1) { edges { node { url altText } } }
        } }
      }
    }`);
    var allProducts = result.data.products.edges.map(function(e) {
      var n = e.node;
      return {
        id: n.id, title: n.title, handle: n.handle, productType: n.productType,
        availableForSale: n.availableForSale,
        variants: n.variants.edges.map(function(v) { return v.node; }),
        images: n.images.edges.map(function(img) { return { src: img.node.url }; })
      };
    });

    var related = allProducts
      .filter(function(p) { return p.id !== currentProduct.id; })
      .filter(function(p) { return p.productType === currentProduct.productType; })
      .slice(0, 4);

    if (related.length === 0) {
      related = allProducts.filter(function(p) { return p.id !== currentProduct.id; }).slice(0, 4);
    }
    if (related.length === 0) { section.style.display = 'none'; return; }
    section.style.display = '';
    renderRelatedGrid(grid, related);
  } catch (err) {
    section.style.display = 'none';
  }
}

function renderRelatedGrid(container, products) {
  container.innerHTML = '';
  products.forEach(function(product, i) {
    var variant = product.variants[0];
    var price = parseFloat(variant.price.amount).toFixed(2).replace('.', ',');
    var imgSrc = product.images[0] ? product.images[0].src : '';
    var handle = product.handle || '';

    var card = document.createElement('a');
    card.href = 'product.html?handle=' + encodeURIComponent(handle);
    card.className = 'product-card-link';
    card.innerHTML = '<div class="product-card reveal visible" data-base-price="' + price + '">'
      + '<div class="product-img">'
      + (imgSrc
        ? '<img src="' + encodeURI(imgSrc) + '" alt="' + escapeHTML(product.title) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:16px 16px 0 0;" />'
        : '<div class="product-img-placeholder"></div>')
      + '</div>'
      + '<div class="product-info">'
      + '<h3 class="product-name">' + escapeHTML(product.title) + '</h3>'
      + '<div class="product-bottom">'
      + '<div class="product-price">' + price + ' &euro;</div>'
      + '</div>'
      + '</div>'
      + '</div>';
    container.appendChild(card);
  });
}

// ============ INIT ON LOAD ============
window.addEventListener('DOMContentLoaded', function() {
  var urlParams = new URLSearchParams(window.location.search);
  var handle = urlParams.get('handle');
  if (handle && document.getElementById('productDetailContainer')) {
    loadSingleProduct(handle);
  } else {
    initShopify();
  }
});
