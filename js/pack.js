// ============ COMPOSEZ VOTRE PACK ============
// Choix du pack -> choix des parfums -> ajout de chaque bidon au panier Shopify.
// La remise (-8 % dès 2 bidons, -12 % dès 4) est une remise automatique Shopify : elle s'applique au panier et au paiement.
(function () {
  var PACKS = [
    { id: 'duo-lessives', name: 'Duo Lessives', desc: '2 lessives au choix', slots: ['L', 'L'] },
    { id: 'duo-adoucissants', name: 'Duo Adoucissants', desc: '2 adoucissants au choix', slots: ['A', 'A'] },
    { id: 'duo-mixte', name: 'Duo Mixte', desc: '1 lessive + 1 adoucissant', slots: ['L', 'A'] },
    { id: 'famille', name: 'Pack Famille', desc: '4 bidons, composez librement', slots: ['X', 'X', 'X', 'X'], badge: '-12 %' }
  ];
  var KIND_LABEL = { L: 'Lessive', A: 'Adoucissant', X: 'Bidon' };
  var state = { pack: null, picks: [], products: [] };

  function pct(n) { return n >= 4 ? 0.12 : (n >= 2 ? 0.08 : 0); }
  function money(v) { return v.toFixed(2).replace('.', ',') + ' €'; }
  function esc(s) { return window.escapeHTML ? window.escapeHTML(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function kindOf(p) { return (window.ProPureProductCategories && window.ProPureProductCategories.classifyProduct(p)) === 'adoucissants' ? 'A' : 'L'; }
  function scent(p) {
    return String(p.title || '').split(' – ')[0].replace(/^Lessive liquide\s+/i, '').replace(/^Adoucissant\s+/i, '').replace(/\s*5\s*L\s*$/i, '').trim();
  }
  function unitPrice(p) { var v = p.variants && p.variants[0]; return v ? parseFloat(v.price.amount || v.price) : 0; }
  function inStock(p) { return p.availableForSale !== false && p.variants && p.variants[0] && p.variants[0].availableForSale !== false; }
  function img(p) { return p.images && p.images[0] ? p.images[0].src : ''; }

  function load() {
    var all = window.__proPureProducts || [];
    state.products = all.filter(function (p) {
      var c = window.ProPureProductCategories ? window.ProPureProductCategories.classifyProduct(p) : 'other';
      return c === 'lessives' || c === 'adoucissants';
    });
    renderTypes();
    if (!state.pack) select(PACKS[0].id, true); else renderSlots();
  }

  function available(kinds) {
    return state.products.some(function (p) { return inStock(p) && (kinds === 'X' || kindOf(p) === kinds); });
  }

  function packAvailable(pk) {
    return pk.slots.every(function (k) { return available(k); });
  }

  function renderTypes() {
    var el = document.getElementById('packTypes');
    el.innerHTML = PACKS.map(function (pk) {
      var ok = packAvailable(pk);
      return '<button type="button" class="pack-type' + (state.pack === pk.id ? ' active' : '') + (ok ? '' : ' disabled') + '" data-id="' + pk.id + '" role="radio" aria-checked="' + (state.pack === pk.id) + '"' + (ok ? '' : ' disabled') + '>'
        + (pk.badge ? '<span class="pack-badge">' + pk.badge + '</span>' : '')
        + '<strong>' + esc(pk.name) + '</strong><span>' + esc(pk.desc) + '</span>'
        + (ok ? '' : '<em>Bientôt disponible</em>') + '</button>';
    }).join('');
    el.querySelectorAll('.pack-type').forEach(function (b) { b.addEventListener('click', function () { select(b.getAttribute('data-id')); }); });
  }

  function select(id, silent) {
    var pk = PACKS.filter(function (x) { return x.id === id; })[0];
    if (!pk) return;
    state.pack = id;
    state.picks = pk.slots.map(function () { return null; });
    // présélection : premier parfum disponible de chaque type
    pk.slots.forEach(function (k, i) {
      var first = state.products.filter(function (p) { return inStock(p) && (k === 'X' || kindOf(p) === k); })[0];
      state.picks[i] = first ? first.id : null;
    });
    renderTypes(); renderSlots();
  }

  function currentPack() { return PACKS.filter(function (x) { return x.id === state.pack; })[0]; }

  function renderSlots() {
    var pk = currentPack(); if (!pk) return;
    var el = document.getElementById('packSlots');
    el.innerHTML = pk.slots.map(function (k, i) {
      var opts = state.products.filter(function (p) { return k === 'X' || kindOf(p) === k; });
      return '<div class="pack-slot"><div class="pack-slot-title">' + KIND_LABEL[k] + ' ' + (i + 1) + '<span> / ' + pk.slots.length + '</span></div><div class="pack-chips" role="radiogroup" aria-label="' + KIND_LABEL[k] + ' ' + (i + 1) + '">'
        + opts.map(function (p) {
          var ok = inStock(p), on = state.picks[i] === p.id;
          return '<button type="button" class="pack-chip' + (on ? ' active' : '') + (ok ? '' : ' disabled') + '" data-slot="' + i + '" data-id="' + esc(p.id) + '" role="radio" aria-checked="' + on + '"' + (ok ? '' : ' disabled') + '>'
            + (img(p) ? '<img src="' + encodeURI(img(p)) + '" alt="" loading="lazy">' : '')
            + '<span class="pack-chip-name">' + esc(scent(p)) + '</span>'
            + '<span class="pack-chip-kind">' + (kindOf(p) === 'A' ? 'Adoucissant' : 'Lessive') + '</span>'
            + (ok ? '' : '<em>Bientôt</em>') + '</button>';
        }).join('') + '</div></div>';
    }).join('');
    el.querySelectorAll('.pack-chip').forEach(function (b) {
      b.addEventListener('click', function () { state.picks[+b.getAttribute('data-slot')] = b.getAttribute('data-id'); renderSlots(); });
    });
    renderSummary();
  }

  function byId(id) { return state.products.filter(function (p) { return p.id === id; })[0]; }

  function renderSummary() {
    var chosen = state.picks.map(byId).filter(Boolean);
    var full = chosen.length === state.picks.length && chosen.length > 0;
    var sum = chosen.reduce(function (a, p) { return a + unitPrice(p); }, 0);
    var d = pct(state.picks.length), total = sum * (1 - d);
    document.getElementById('packLines').innerHTML = chosen.map(function (p) {
      return '<div class="pack-line"><span>' + esc(KIND_LABEL[kindOf(p)]) + ' ' + esc(scent(p)) + ' · 5 L</span><span>' + money(unitPrice(p)) + '</span></div>';
    }).join('');
    document.getElementById('packOld').textContent = d ? money(sum) : '';
    document.getElementById('packTotal').textContent = full ? money(total) : '—';
    document.getElementById('packSave').textContent = d && full ? 'Vous économisez ' + money(sum - total) + ' (−' + Math.round(d * 100) + ' %)' : '';
    var btn = document.getElementById('packAdd');
    btn.disabled = !full;
    btn.textContent = full ? 'Ajouter le pack au panier — ' + money(total) : 'Choisissez vos parfums';
  }

  async function addPack() {
    var btn = document.getElementById('packAdd');
    var chosen = state.picks.map(byId).filter(Boolean);
    if (!chosen.length || chosen.length !== state.picks.length) return;
    var qty = {};
    chosen.forEach(function (p) { var v = p.variants[0].id; qty[v] = (qty[v] || 0) + 1; });
    var lines = Object.keys(qty).map(function (v) { return { merchandiseId: v, quantity: qty[v] }; });
    btn.disabled = true;
    try {
      if (typeof showToast === 'function') showToast();
      await cartLinesAdd(lines);
      setTimeout(function () { var dr = document.getElementById('cartDrawer'); if (dr && !dr.classList.contains('open')) toggleCart(); }, 400);
    } catch (e) {
      if (typeof showCartError === 'function') showCartError('Impossible d’ajouter le pack pour le moment. Réessayez dans quelques instants.');
    }
    btn.disabled = false;
  }

  document.addEventListener('products:loaded', load);
  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('packAdd').addEventListener('click', addPack);
    if (window.__proPureProducts) load();
  });
})();
