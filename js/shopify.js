// ============ SHOPIFY STOREFRONT API ============
const SHOPIFY_DOMAIN = '47kjax-uw.myshopify.com';
// Le token public est optionnel pour les requêtes utilisées ici (produits, plans de vente et panier).
// Si des fonctionnalités Storefront protégées sont ajoutées plus tard, remplacer cette valeur par
// un token public créé dans Shopify Admin. Ne jamais placer de token privé dans ce fichier client.
const STOREFRONT_TOKEN = '';
const STOREFRONT_API_VERSION = '2026-07';

// --- Selling Plans (abonnement) ---
// Les formules viennent de l'app Shopify Subscriptions (forfait « Abonnement Pro Pure ») et sont lues
// dynamiquement. La fréquence (en mois) est extraite du premier nombre de l'option de la formule.
// Aucune valeur n'est codée en dur : si un produit n'a pas de formule, l'abonnement n'est pas proposé.
let sellingPlanMap = {};              // fréquence (mois) -> id de formule (repli global)
let sellingPlansByProduct = {};       // id produit -> { fréquence: { id, pct } }
let planDiscounts = {};               // fréquence (mois) -> pourcentage de remise réel

function registerSellingPlans(productId, groupEdges) {
  (groupEdges || []).forEach(function(groupEdge) {
    var plans = groupEdge.node.sellingPlans.edges;
    plans.forEach(function(planEdge) {
      var plan = planEdge.node;
      var option = plan.options && plan.options[0];
      var monthMatch = option && option.value ? option.value.match(/(\d+)/) : null;
      if (!monthMatch) return;
      var months = monthMatch[1];
      var adj = plan.priceAdjustments && plan.priceAdjustments[0];
      var pct = adj && adj.adjustmentValue ? adj.adjustmentValue.adjustmentPercentage : null;
      if (typeof pct !== 'number') return;   // formule sans remise en % : ignorée
      sellingPlanMap[months] = plan.id;
      planDiscounts[months] = pct;
      if (productId) {
        sellingPlansByProduct[productId] = sellingPlansByProduct[productId] || {};
        sellingPlansByProduct[productId][months] = { id: plan.id, pct: pct };
      }
    });
  });
}

// Remise réelle (0-1) pour une fréquence, ou null si aucune formule correspondante.
function discountRateFor(months, productId) {
  var byProduct = productId && sellingPlansByProduct[productId];
  if (byProduct && byProduct[months]) return byProduct[months].pct / 100;
  if (!productId && typeof planDiscounts[months] === 'number') return planDiscounts[months] / 100;
  return null;
}

function planIdFor(months, productId) {
  var byProduct = productId && sellingPlansByProduct[productId];
  return byProduct && byProduct[months] ? byProduct[months].id : null;
}

function formatPct(rate) {
  return String(Math.round(rate * 1000) / 10).replace('.', ',');
}

// --- Cart State (GraphQL Cart API) ---
let cartId = null;
let cartCheckoutUrl = null;
let cartItemsData = [];
var cartUpdating = false;

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
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c];
  });
}

// ============ STOREFRONT API GRAPHQL HELPER ============
async function storefrontFetch(query, variables) {
  var headers = {
    'Content-Type': 'application/json'
  };
  if (STOREFRONT_TOKEN && !STOREFRONT_TOKEN.startsWith('REMPLACER_')) {
    headers['X-Shopify-Storefront-Access-Token'] = STOREFRONT_TOKEN;
  }

  const response = await fetch(
    'https://' + SHOPIFY_DOMAIN + '/api/' + STOREFRONT_API_VERSION + '/graphql.json',
    {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ query: query, variables: variables || {} }),
    }
  );
  var data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error('Storefront API HTTP error: ' + response.status);
  }
  if (data.errors && data.errors.length) {
    throw new Error(data.errors.map(function(error) {
      return error.message || 'Erreur Shopify inconnue';
    }).join(' | '));
  }
  if (!response.ok) {
    throw new Error('Storefront API HTTP error: ' + response.status);
  }
  return data;
}

function showStorefrontUnavailable() {
  var skeleton = document.getElementById('catalogueSkeleton');
  if (skeleton) skeleton.style.display = 'none';

  var grid = document.getElementById('catalogueGrid');
  if (!grid) return;

  while (grid.firstChild) grid.removeChild(grid.firstChild);
  var status = document.createElement('div');
  status.className = 'catalogue-status';
  status.setAttribute('role', 'status');

  var title = document.createElement('h2');
  title.textContent = 'Catalogue momentanément indisponible';
  var message = document.createElement('p');
  message.textContent = 'Notre boutique est en cours de mise à jour. Revenez prochainement pour découvrir tous nos produits.';
  var link = document.createElement('a');
  link.href = 'index.html';
  link.textContent = 'Retour à l’accueil';

  status.appendChild(title);
  status.appendChild(message);
  status.appendChild(link);
  grid.appendChild(status);
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
  try {
    // Restore cart, fetch selling plans, and fetch products in parallel
    var savedCartId = getSavedCartId();

    var [_, __, productsResult] = await Promise.all([
      savedCartId ? restoreCart(savedCartId).catch(function() { clearSavedCart(); return null; }) : createCart([]),
      fetchSellingPlans(),
      storefrontFetch(
        'query { products(first: 50) { edges { node { id title handle description productType tags availableForSale sellingPlanGroups(first: 5) { edges { node { sellingPlans(first: 5) { edges { node { id name options { name value } priceAdjustments { adjustmentValue { ... on SellingPlanPercentagePriceAdjustment { adjustmentPercentage } } } } } } } } } variants(first: 10) { edges { node { id title price { amount currencyCode } availableForSale } } } images(first: 5) { edges { node { url altText } } } } } } }'
      )
    ]);

    // If cart restore returned null (failed or no saved ID), ensure we have a cart
    if (!cartId) {
      await createCart([]);
    }

    // Map GraphQL products to the format expected by updateProductsFromShopify
    if (productsResult && productsResult.data && productsResult.data.products) {
      var products = productsResult.data.products.edges.map(function(edge) {
        var node = edge.node;
        return {
          id: node.id,
          title: node.title,
          handle: node.handle,
          description: node.description,
          productType: node.productType,
          availableForSale: node.availableForSale,
          tags: node.tags || [],
          variants: node.variants.edges.map(function(v) {
            return {
              id: v.node.id,
              title: v.node.title,
              price: v.node.price,
              availableForSale: v.node.availableForSale
            };
          }),
          images: node.images.edges.map(function(img) {
            return { src: img.node.url, altText: img.node.altText };
          })
        };
      });

      // Also update sellingPlanMap from product data if available
      productsResult.data.products.edges.forEach(function(edge) {
        registerSellingPlans(edge.node.id, edge.node.sellingPlanGroups.edges);
      });

      if (products.length > 0) {
        updateProductsFromShopify(products);
      }
    }
  } catch (err) {
    console.error('Shopify init failed:', err);
    showStorefrontUnavailable();
  }
}

async function fetchSellingPlans() {
  try {
    const result = await storefrontFetch(`{
      products(first: 50) {
        edges {
          node {
            id
            sellingPlanGroups(first: 5) {
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

    result.data.products.edges.forEach(function(edge) {
      registerSellingPlans(edge.node.id, edge.node.sellingPlanGroups.edges);
    });
  } catch (err) {
    // Using fallback selling plan IDs
  }
}

// ============ PRODUCT CARDS ============
let allShopifyProducts = [];

// Fréquences proposées pour un produit, triées (ex. ['2', '4']). Vide = pas d'abonnement.
function productFrequencies(productId) {
  var plans = sellingPlansByProduct[productId] || {};
  return Object.keys(plans).sort(function(a, b) { return Number(a) - Number(b); });
}

// Bloc abonnement d'une carte produit, construit uniquement à partir des formules Shopify réelles.
function buildCardSubscriptionHtml(productId, basePrice) {
  var freqs = productFrequencies(productId);
  if (!freqs.length) return '';
  var first = freqs[0];
  var firstRate = discountRateFor(first, productId);
  var bestRate = Math.max.apply(null, freqs.map(function(f) { return discountRateFor(f, productId); }));
  var saving = (basePrice * firstRate).toFixed(2).replace('.', ',');
  var freqButtons = freqs.map(function(f, idx) {
    var r = discountRateFor(f, productId);
    return '<button class="sub-freq-btn' + (idx === 0 ? ' active' : '') + '" data-freq="' + f + '" data-discount="' + formatPct(r) + '" onclick="setFreq(this,\'' + f + '\')">Tous les ' + f + ' mois (-' + formatPct(r) + '%)</button>';
  }).join('');
  return '<div class="sub-toggle">'
    + '<button class="sub-toggle-btn active" onclick="setMode(this,\'once\')">Achat unique</button>'
    + '<button class="sub-toggle-btn sub-option" onclick="setMode(this,\'sub\')">Abonnement jusqu\'à -' + formatPct(bestRate) + '%</button>'
    + '</div>'
    + '<div class="sub-freq" style="display:none">' + freqButtons + '</div>'
    + '<div class="sub-discount" style="display:none">Économisez ' + saving + ' € sur le produit</div>'
    + '<div class="sub-explainer sub-explainer-card" style="display:none">'
    + '<div class="sub-explainer-items-compact">'
    + '<div><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg> Livraison automatique à la fréquence choisie</div>'
    + '<div><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Modifiable ou annulable à tout moment</div>'
    + '<div><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg> Sans engagement, sans durée minimum</div>'
    + '</div>'
    + '</div>';
}

function buildProductCard(product, i, tagLabel) {
  var variant = product.variants[0];
  var price = parseFloat(variant.price.amount || variant.price).toFixed(2).replace('.', ',');
  var imgSrc = product.images[0] ? product.images[0].src : '';
  var inStock = product.availableForSale !== false;
  var subHtml = buildCardSubscriptionHtml(product.id, parseFloat(price.replace(',', '.')));

  var card = document.createElement('div');
  card.className = 'product-card reveal visible';
  card.setAttribute('data-base-price', price);
  card.setAttribute('data-variant-id', variant.id);
  card.setAttribute('data-product-id', product.id);
  var pType = (product.productType || '').toLowerCase();
  card.setAttribute('data-product-type', pType);
  var productCategory = window.ProPureProductCategories
    ? window.ProPureProductCategories.classifyProduct(product)
    : 'other';
  card.setAttribute('data-product-category', productCategory);
  var tags = product.tags || [];
  card.setAttribute('data-tags', tags.join(',').toLowerCase());

  var handle = product.handle || '';
  card.innerHTML = '<a href="' + productUrl(handle) + '" class="product-img" style="display:block;text-decoration:none;">'
    + (imgSrc
      ? '<img src="' + encodeURI(imgSrc) + '" alt="' + escapeHTML(product.title) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:16px 16px 0 0;" />'
      : '<div class="product-img-placeholder" style="background: linear-gradient(180deg, #E8E4F0 0%, #B8A5D4 100%);"></div>')
    + (tagLabel ? '<span class="product-tag">' + escapeHTML(tagLabel) + '</span>' : '')
    + '</a>'
    + '<div class="product-info">'
    + '<a href="' + productUrl(handle) + '" class="product-name" style="text-decoration:none;color:inherit;display:block;">' + escapeHTML(product.title) + '</a>'
    + '<p class="product-desc">' + escapeHTML((product.description || '').substring(0, 60)) + '</p>'
    + subHtml
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

  // --- BEST-SELLERS: trois références actives ---
  var bsGrid = document.getElementById('bestsellersGrid');
  if (bsGrid) {
    // Produits marqués du tag « best-seller » dans Shopify, puis complétés par les autres (3 max).
    // Aucun nom de produit codé en dur : renommer un produit dans Shopify ne vide plus la section.
    var tagged = products.filter(function(p) {
      return (p.tags || []).some(function(t) { return String(t).toLowerCase() === 'best-seller'; });
    });
    var others = products.filter(function(p) { return tagged.indexOf(p) === -1; });
    var top3 = tagged.concat(others).filter(function(p) { return p.availableForSale !== false; }).slice(0, 3);
    if (top3.length) {
      while (bsGrid.firstChild) bsGrid.removeChild(bsGrid.firstChild);
      var bsLabels = ['Best-seller', 'Populaire', 'Top vente'];
      top3.forEach(function(product, i) {
        var card = buildProductCard(product, i, bsLabels[i] || '');
        bsGrid.appendChild(card);
      });
    }
  }

  // --- CATALOGUE: All products ---
  var catGrid = document.getElementById('catalogueGrid');
  if (catGrid) {
    while (catGrid.firstChild) catGrid.removeChild(catGrid.firstChild);
    var catalogueProducts = products.filter(function(product) {
      return !window.ProPureProductCategories ||
        window.ProPureProductCategories.classifyProduct(product) !== 'other';
    });
    catalogueProducts.forEach(function(product, i) {
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
      var planId = planIdFor(subscriptionInfo.frequency, subscriptionInfo.productId);
      if (!planId) {
        // Jamais de \u00ab faux \u00bb abonnement : sans formule Shopify, on n'ajoute rien et on pr\u00e9vient le client.
        showCartError('L\u2019abonnement n\u2019est pas disponible pour ce produit pour le moment. Choisissez \u00ab Achat unique \u00bb.');
        return;
      }
      line.sellingPlanId = planId;
    }

    // Add to cart via GraphQL
    await cartLinesAdd([line]);

  } catch (err) {
    showCartError('Impossible d’ajouter ce produit pour le moment. Réessayez dans quelques instants.');
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
  if (!container || !footer) return;
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
  if (cartUpdating) return;
  cartUpdating = true;
  try {
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
  } finally {
    cartUpdating = false;
  }
}

async function removeItem(index) {
  if (cartUpdating) return;
  cartUpdating = true;
  try {
    var item = cartItemsData[index];
    if (cartId && item.id) {
      await cartLinesRemove([item.id]);
    } else {
      cartItemsData.splice(index, 1);
      renderCart();
    }
  } finally {
    cartUpdating = false;
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
    try {
      var url = new URL(cartCheckoutUrl);
      if (!url.hostname.endsWith('.myshopify.com') && !url.hostname.endsWith('.shopify.com')) {
        return;
      }
    } catch (e) {
      return;
    }
    clearSavedCart();
    window.location.href = cartCheckoutUrl;
  }
}

function showToast() {
  var toast = document.getElementById('cartToast');
  if (!toast) return;
  toast.classList.add('show');
  setTimeout(function() { toast.classList.remove('show'); }, 2000);
  document.dispatchEvent(new CustomEvent('cart:itemAdded'));
}

function showCartError(message) {
  var el = document.getElementById('cartErrorToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cartErrorToast';
    el.setAttribute('role', 'alert');
    el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);max-width:min(92vw,420px);'
      + 'background:#2b2233;color:#fff;padding:12px 16px;border-radius:12px;font-size:.9rem;line-height:1.4;'
      + 'box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:10000;text-align:center;';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.display = 'block';
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(function() { el.style.display = 'none'; }, 5000);
}

// ============ STATIC PRODUCT FALLBACK ============
function addToCartStatic(btn) {
  var card = btn.closest('.product-card');
  var title = card.querySelector('.product-name').textContent;
  var basePrice = card.getAttribute('data-base-price');
  var variantId = card.getAttribute('data-variant-id');
  var subToggle = card.querySelector('.sub-toggle');
  var priceEl = card.querySelector('.product-price');
  var priceMatch = priceEl ? priceEl.textContent.match(/[\d,]+/) : null;
  var finalPrice = basePrice || (priceMatch ? priceMatch[0] : '0,00');
  var suffix = '';
  var subscriptionInfo = null;

  if (subToggle) {
    var subBtn = subToggle.querySelector('.sub-option');
    if (subBtn && subBtn.classList.contains('active')) {
      var numPrice = parseFloat(finalPrice.replace(',', '.'));
      var freqBtn = card.querySelector('.sub-freq-btn.active');
      var productId = card.getAttribute('data-product-id');
      var months = freqBtn ? freqBtn.getAttribute('data-freq') : productFrequencies(productId)[0];
      var discountRate = discountRateFor(months, productId);
      if (discountRate === null) {
        showCartError('L’abonnement n’est pas disponible pour ce produit pour le moment. Choisissez « Achat unique ».');
        return;
      }
      finalPrice = (numPrice * (1 - discountRate)).toFixed(2).replace('.', ',');
      suffix = ' (Abo ' + months + ' mois)';
      subscriptionInfo = { frequency: months, price: finalPrice, productId: productId };
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
    // Sans panier Shopify, aucun ajout « local » : il mènerait à un panier impossible à payer.
    showCartError('La boutique est momentanément indisponible. Réessayez dans quelques minutes ou écrivez-nous à contact@p-pure.com.');
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
    if (freqDiv) { freqDiv.style.display = ''; freqDiv.classList.add('visible'); }
    if (discountDiv) { discountDiv.style.display = ''; discountDiv.classList.add('visible'); }
    if (savingBox) { savingBox.style.display = ''; savingBox.classList.add('visible'); }
    if (explainerDiv) { explainerDiv.style.display = ''; explainerDiv.classList.add('visible'); }
    var activeFreqBtn = card.querySelector('.sub-freq-btn.active');
    var productId = card.getAttribute('data-product-id');
    var months = activeFreqBtn ? activeFreqBtn.getAttribute('data-freq') : productFrequencies(productId)[0];
    var discountRate = discountRateFor(months, productId);
    if (discountRate === null) return;
    var discountPct = formatPct(discountRate);
    var discounted = (basePrice * (1 - discountRate)).toFixed(2).replace('.', ',');
    var saving = (basePrice * discountRate).toFixed(2).replace('.', ',');
    var deliveriesPerYear = Math.floor(12 / Number(months));
    var annualSaving = (basePrice * discountRate * deliveriesPerYear).toFixed(0);
    while (priceEl.firstChild) priceEl.removeChild(priceEl.firstChild);
    var oldPriceSpan = document.createElement('span');
    oldPriceSpan.style.cssText = 'text-decoration:line-through;opacity:.5;font-size:.85em;margin-right:6px';
    oldPriceSpan.textContent = basePrice.toFixed(2).replace('.', ',') + ' \u20ac';
    priceEl.appendChild(oldPriceSpan);
    priceEl.appendChild(document.createTextNode(discounted + ' \u20ac'));
    if (discountDiv) discountDiv.textContent = '\u00c9conomisez ' + saving + ' \u20ac sur le produit';
    // Update saving box
    var savingPerDelivery = card.querySelector('.sub-saving-per-delivery');
    if (savingPerDelivery) savingPerDelivery.innerHTML = '\u00c9conomisez <strong>' + saving + ' \u20ac</strong> sur le produit';
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
    if (freqDiv) { freqDiv.style.display = 'none'; freqDiv.classList.remove('visible'); }
    if (discountDiv) { discountDiv.style.display = ''; discountDiv.classList.remove('visible'); }
    if (savingBox) { savingBox.style.display = 'none'; savingBox.classList.remove('visible'); }
    if (explainerDiv) { explainerDiv.style.display = 'none'; explainerDiv.classList.remove('visible'); }
    priceEl.textContent = basePrice.toFixed(2).replace('.', ',') + ' \u20ac';
  }
}

function setFreq(btn, months) {
  var card = btn.closest('.product-card');
  var freqBtns = card.querySelectorAll('.sub-freq-btn');
  freqBtns.forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');

  var basePrice = parseFloat(card.getAttribute('data-base-price').replace(',', '.'));
  var discountRate = discountRateFor(months, card.getAttribute('data-product-id'));
  if (discountRate === null) return;
  var discountPct = formatPct(discountRate);
  var discounted = (basePrice * (1 - discountRate)).toFixed(2).replace('.', ',');
  var saving = (basePrice * discountRate).toFixed(2).replace('.', ',');
  var deliveriesPerYear = Math.floor(12 / Number(months));
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

  if (discountDiv) {
    discountDiv.textContent = '\u00c9conomisez ' + saving + ' \u20ac sur le produit';
    discountDiv.style.display = '';
    discountDiv.classList.add('visible');
  }

  // Update saving box and ensure visibility
  var savingBox = card.querySelector('.sub-saving-box');
  var explainerDiv = card.querySelector('.sub-explainer');
  var savingPerDelivery = card.querySelector('.sub-saving-per-delivery');
  if (savingPerDelivery) savingPerDelivery.innerHTML = '\u00c9conomisez <strong>' + saving + ' \u20ac</strong> sur le produit';
  var annualEl = card.querySelector('#subAnnualSaving');
  if (annualEl) annualEl.textContent = annualSaving + ' \u20ac';
  if (savingBox) { savingBox.style.display = ''; savingBox.classList.add('visible'); }
  if (explainerDiv) { explainerDiv.style.display = ''; explainerDiv.classList.add('visible'); }

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
// Bloc « Choisissez votre formule » de la fiche produit, à partir des formules Shopify réelles.
function buildDetailSubscriptionHtml(productId, basePrice, priceLabel) {
  var freqs = productFrequencies(productId);
  if (!freqs.length) return '';
  var first = freqs[0];
  var firstRate = discountRateFor(first, productId);
  var bestRate = Math.max.apply(null, freqs.map(function(f) { return discountRateFor(f, productId); }));
  var saving = (basePrice * firstRate).toFixed(2).replace('.', ',');
  var annual = (basePrice * firstRate * Math.floor(12 / Number(first))).toFixed(0);
  var freqButtons = freqs.map(function(f, idx) {
    var r = discountRateFor(f, productId);
    return '<button class="sub-freq-btn' + (idx === 0 ? ' active' : '') + '" data-freq="' + f + '" data-discount="' + formatPct(r) + '" onclick="setFreq(this,\'' + f + '\')">Tous les ' + f + ' mois <strong>-' + formatPct(r) + '%</strong></button>';
  }).join('');
  return '<div class="sub-section-detail">'
    + '<div class="sub-section-header">'
    + '<span class="sub-section-title">Choisissez votre formule</span>'
    + '</div>'
    + '<div class="sub-toggle sub-toggle-detail">'
    + '<button class="sub-toggle-btn active" onclick="setMode(this,\'once\')">'
    + '<span class="sub-btn-title">Achat unique</span>'
    + '<span class="sub-btn-price">' + priceLabel + ' \u20ac</span>'
    + '</button>'
    + '<button class="sub-toggle-btn sub-option" onclick="setMode(this,\'sub\')">'
    + '<span class="sub-btn-title">Abonnement <span class="sub-option-badge">-' + formatPct(firstRate) + '%</span></span>'
    + '<span class="sub-btn-price">' + (basePrice * (1 - firstRate)).toFixed(2).replace('.', ',') + ' \u20ac</span>'
    + '</button>'
    + '</div>'
    + '<div class="sub-freq" style="display:none">'
    + '<span class="sub-freq-label">Fr\u00e9quence de livraison :</span>'
    + '<div class="sub-freq-options">' + freqButtons + '</div>'
    + '</div>'
    + '<div class="sub-saving-box" style="display:none">'
    + '<div class="sub-saving-per-delivery">\u00c9conomisez <strong>' + saving + ' \u20ac</strong> sur le produit</div>'
    + '<div class="sub-saving-annual">Soit <strong id="subAnnualSaving">' + annual + ' \u20ac</strong> d\'\u00e9conomie par an</div>'
    + '</div>'
    + '<div class="sub-explainer" style="display:none">'
    + '<div class="sub-explainer-title">'
    + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
    + ' Comment fonctionne l\u2019abonnement ?'
    + '</div>'
    + '<div class="sub-explainer-grid">'
    + '<div class="sub-explainer-item"><span class="sub-explainer-icon">\u2795</span><strong>Recevez automatiquement</strong> votre produit \u00e0 la fr\u00e9quence choisie, sans y penser</div>'
    + '<div class="sub-explainer-item"><span class="sub-explainer-icon">\u270f\ufe0f</span><strong>100% flexible</strong> : changez de fr\u00e9quence, suspendez ou annulez depuis votre espace client</div>'
    + '<div class="sub-explainer-item"><span class="sub-explainer-icon">\ud83d\udcb0</span><strong>Prix r\u00e9duit garanti</strong> sur chaque livraison, jusqu\'\u00e0 ' + formatPct(bestRate) + '% d\'\u00e9conomie</div>'
    + '<div class="sub-explainer-item"><span class="sub-explainer-icon">\ud83d\ude9a</span><strong>Aucun engagement</strong> : sans dur\u00e9e minimum, arr\u00eatez quand vous voulez</div>'
    + '</div>'
    + '</div>'
    + '</div>';
}

// Pages produit statiques (générées par scripts/gen_products.py) : meilleures pour le SEO
// Description Shopify : on ne garde que des balises de mise en forme simples
function sanitizeDescriptionHtml(h) {
  var d = document.createElement('div');
  d.innerHTML = h;
  var ok = { P: 1, UL: 1, OL: 1, LI: 1, STRONG: 1, B: 1, EM: 1, I: 1, BR: 1 };
  (function clean(n) {
    Array.prototype.slice.call(n.childNodes).forEach(function(c) {
      if (c.nodeType === 8) { n.removeChild(c); return; }
      if (c.nodeType !== 1) return;
      if (!ok[c.tagName]) { n.replaceChild(document.createTextNode(c.textContent), c); return; }
      while (c.attributes.length) c.removeAttribute(c.attributes[0].name);
      clean(c);
    });
  })(d);
  return d.innerHTML;
}

// Découpe la description Shopify : intro, points forts, mode d'emploi, composition
function splitProductDescription(html, text) {
  var out = { intro: '', highlights: '', usage: '', composition: '' };
  if (!html) { out.intro = escapeHTML(text); return out; }
  var d = document.createElement('div');
  d.innerHTML = sanitizeDescriptionHtml(html);
  Array.prototype.slice.call(d.children).forEach(function(el) {
    if (el.tagName === 'UL' && !out.highlights) { out.highlights = el.innerHTML; return; }
    var t = (el.textContent || '').trim();
    if (!out.intro && el.tagName === 'P' && !/^(machine|lavage|composition|tenir|dosage)/i.test(t)) { out.intro = el.outerHTML; return; }
    if (/^(composition|tenir|attention|danger|contient)/i.test(t)) out.composition += el.outerHTML;
    else out.usage += el.outerHTML;
  });
  return out;
}
function washesFromText(t) {
  var m = /(\d{2,4})\s*lavages/i.exec(t || '');
  return m ? parseInt(m[1], 10) : 0;
}

var STATIC_PRODUCT_HANDLES = ["lessive-marine-5-l", "lessive-prestige-5-l", "lessive-air-de-montagne-5-l", "lessive-alpine-5-l", "lessive-fraicheur-5-l", "lessive-musc-blanc-5-l", "lessive-mystere-5-l", "lessive-savon-de-marseille-5-l", "lessive-souffle-mysterieux-5-l", "adoucissant-air-de-montagne-5-l", "adoucissant-douceur-prestige-5-l", "adoucissant-fraicheur-5-l", "adoucissant-souffle-mysterieux-5-l"];
function productUrl(handle) {
  return STATIC_PRODUCT_HANDLES.indexOf(handle) !== -1 ? handle + '.html' : 'product.html?handle=' + encodeURIComponent(handle);
}

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
          id title handle description descriptionHtml productType availableForSale
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
      descriptionHtml: productData.descriptionHtml,
      productType: productData.productType,
      availableForSale: productData.availableForSale,
      variants: productData.variants.edges.map(function(e) { return e.node; }),
      images: productData.images.edges.map(function(e) { return { src: e.node.url, altText: e.node.altText }; })
    };

    var variant = product.variants[0];
    var basePrice = parseFloat(variant.price.amount);
    var price = basePrice.toFixed(2).replace('.', ',');
    var detailSubHtml = buildDetailSubscriptionHtml(product.id, basePrice, price);
    var images = product.images || [];
    var mainImg = images[0] ? images[0].src : '';
    var pType = (product.productType || '').replace(/^\w/, function(c) { return c.toUpperCase(); });
    var inStock = product.availableForSale !== false;

    var breadcrumb = document.getElementById('productBreadcrumb');
    if (breadcrumb) {
      breadcrumb.innerHTML = '<a href="index.html">Accueil</a><span>&rsaquo;</span><a href="catalogue.html">Catalogue</a><span>&rsaquo;</span>' + escapeHTML(product.title);
    }
    var breadcrumbCurrent = document.getElementById('breadcrumbProduct');
    if (breadcrumbCurrent) {
      breadcrumbCurrent.textContent = product.title;
    }
    if (!document.body.getAttribute('data-handle')) document.title = product.title + ' \u2014 Pro Pure';

    var thumbsHtml = '';
    if (images.length > 1) {
      images.forEach(function(img, i) {
        thumbsHtml += '<div class="product-gallery-thumb' + (i === 0 ? ' active' : '') + '" onclick="changeMainImage(this, \'' + encodeURI(img.src) + '\')">'
          + '<img src="' + encodeURI(img.src) + '" alt="' + escapeHTML(product.title) + ' ' + (i+1) + '" loading="lazy" />'
          + '</div>';
      });
    }

    var parts = splitProductDescription(product.descriptionHtml || '', product.description || '');
    var perWash = washesFromText(product.title + ' ' + (product.description || ''));
    var perWashHtml = perWash ? '<div class="pd-per-wash">soit <strong>' + (basePrice / perWash).toFixed(2).replace('.', ',') + ' &euro;</strong> par lavage &middot; ' + perWash + ' lavages</div>' : '';
    var acc = function(title, body, open) {
      return body ? '<details class="pd-acc"' + (open ? ' open' : '') + '><summary>' + title + '</summary><div class="pd-acc-body">' + body + '</div></details>' : '';
    };

    container.innerHTML = '<div class="product-detail pd-v2">'
      + '<div class="product-gallery">'
      + '<div class="product-gallery-main">'
      + '<img id="mainProductImage" src="' + encodeURI(mainImg) + '" alt="' + escapeHTML((images[0] && images[0].altText) || product.title) + '" />'
      + '</div>'
      + (thumbsHtml ? '<div class="product-gallery-thumbs">' + thumbsHtml + '</div>' : '')
      + '</div>'
      + '<div class="product-info">'
      + (pType ? '<div class="product-category">' + escapeHTML(pType) + '</div>' : '')
      + '<h1 class="product-title">' + escapeHTML(product.title) + '</h1>'
      + (parts.intro ? '<div class="pd-intro">' + parts.intro + '</div>' : '')
      + '<div class="product-card" data-base-price="' + price + '" data-variant-id="' + variant.id + '" data-product-id="' + escapeHTML(product.id) + '" style="background:none;box-shadow:none;padding:0;">'
      + '<span class="product-name" style="display:none">' + escapeHTML(product.title) + '</span>'
      + '<div class="product-bottom pd-price-row"><div class="product-price">' + price + ' &euro;</div></div>'
      + perWashHtml
      + detailSubHtml
      + (inStock
        ? '<div class="pd-buy-row"><div class="qty-selector" data-qty="1">'
          + '<button type="button" onclick="changeDetailQty(this,-1)" aria-label="Diminuer la quantité">&minus;</button>'
          + '<span id="detailQty">1</span>'
          + '<button type="button" onclick="changeDetailQty(this,1)" aria-label="Augmenter la quantité">+</button>'
          + '</div>'
          + '<button class="product-add-btn add-to-cart-btn ripple-btn" onclick="addToCartStatic(this)">'
          + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>'
          + ' Ajouter au panier</button></div>'
        : '<div class="out-of-stock-banner">Rupture de stock &middot; bientôt de retour</div>')
      + '</div>'
      + '<div class="delivery-estimate" id="deliveryEstimate"></div>'
      + (parts.highlights ? '<ul class="pd-highlights">' + parts.highlights + '</ul>' : '')
      + '<div class="pd-accordions">'
      + acc('Mode d’emploi', parts.usage, false)
      + acc('Composition &amp; sécurité', parts.composition, false)
      + acc('Livraison &amp; abonnement', '<p>Expédition sous 2 jours ouvrés. Livraison en France en 3 à 5 jours ouvrés (5,90 &euro;, offerte dès 39 &euro;). Genève–Nyon : livraison sur rendez-vous, offerte dès 49 &euro;.</p><p>Abonnement sans engagement : modifiable ou résiliable en ligne à tout moment depuis votre compte.</p>', false)
      + '</div>'
      + '<div class="trust-badges">'
      + '<div class="trust-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Fabriqué en France</span></div>'
      + '<div class="trust-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg><span>Paiement sécurisé</span></div>'
      + '<div class="trust-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg><span>Livraison France &amp; Genève–Nyon</span></div>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Calculate estimated delivery date
    updateDeliveryEstimate();

    loadRelatedProducts(product);

  } catch (err) {
    var bc = document.getElementById('breadcrumbProduct'); if (bc) bc.textContent = 'Produit';
    container.innerHTML = '<div class="product-not-found"><h2>Produit momentan\u00e9ment indisponible</h2><p>La boutique ne r\u00e9pond pas pour le moment. R\u00e9essayez dans quelques minutes ou \u00e9crivez-nous \u00e0 <a href="mailto:contact@p-pure.com">contact@p-pure.com</a>.</p><a href="index.html">&larr; Retour \u00e0 l\'accueil</a></div>';
  }
}

function updateDeliveryEstimate() {
  var el = document.getElementById('deliveryEstimate');
  if (!el) return;
  // Délais alignés sur les CGV : pas de date calculée qui ne pourrait pas être tenue.
  el.textContent = 'Exp\u00e9dition sous 2 jours ouvr\u00e9s \u00b7 Livraison en France en 3 \u00e0 5 jours ouvr\u00e9s \u00b7 Livraison Gen\u00e8ve\u2013Nyon sur rendez-vous';
}

function productFormatLabel(title) {
  var m = String(title || '').match(/(\d+(?:[.,]\d+)?)\s?(L|ml)\b/i);
  return m ? 'Format ' + m[1] + ' ' + (m[2].toLowerCase() === 'ml' ? 'ml' : 'L') : 'Grand format';
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
    card.href = productUrl(handle);
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
      + '<div class="product-price">' + price + ' &euro;' + (product.availableForSale === false ? ' <span class="pd-oos-tag">Rupture</span>' : '') + '</div>'
      + '</div>'
      + '</div>'
      + '</div>';
    container.appendChild(card);
  });
}

// ============ INIT ON LOAD ============
// Les cartes statiques du HTML (sans data-product-id) ne connaissent pas les formules Shopify :
// leurs blocs d'abonnement restent masqués. Les cartes construites depuis Shopify affichent le leur
// seulement si le produit a une formule réelle.
(function hideStaticSubscriptionBlocks() {
  var style = document.createElement('style');
  style.textContent = '.product-card:not([data-product-id]) .sub-toggle,'
    + '.product-card:not([data-product-id]) .sub-freq,'
    + '.product-card:not([data-product-id]) .sub-discount,'
    + '.product-card:not([data-product-id]) .sub-explainer{display:none!important;}';
  document.head.appendChild(style);
})();

// Sans aucune formule d'abonnement active dans la boutique, on masque la section et les liens « abonnement ».
function syncSubscriptionVisibility() {
  var hasPlans = Object.keys(sellingPlanMap).length > 0;
  document.querySelectorAll('#abonnement, a[href*="gerer-abonnement"]').forEach(function(el) {
    el.style.display = hasPlans ? '' : 'none';
  });
}

window.addEventListener('DOMContentLoaded', async function() {
  var urlParams = new URLSearchParams(window.location.search);
  var handle = urlParams.get('handle') || (document.body && document.body.getAttribute('data-handle'));
  if (handle && document.getElementById('productDetailContainer')) {
    await loadSingleProduct(handle);
  } else {
    await initShopify();
  }
  syncSubscriptionVisibility();
});
