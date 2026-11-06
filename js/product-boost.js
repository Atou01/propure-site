/* Page produit : prix par lavage + barre d'achat collante (mobile). Aucune donnée inventée. */
(function () {
  function run() {
    var root = document.querySelector('.pd-v2');
    if (!root || root.dataset.boost) return;
    root.dataset.boost = '1';
    var card = root.querySelector('.product-card');
    var btn = root.querySelector('.product-add-btn');
    if (!card || !btn) return;
    var price = parseFloat(String(card.getAttribute('data-base-price')).replace(',', '.'));
    var handle = (document.body.getAttribute('data-handle') || location.pathname);
    var washes = /adoucissant/.test(handle) ? 150 : 120;
    var row = root.querySelector('.pd-price-row');
    if (row && price) {
      var per = (price / washes).toFixed(2).replace('.', ',');
      var p = document.createElement('p');
      p.className = 'pd-perwash';
      p.innerHTML = 'Soit seulement <strong>' + per + ' &euro; par lavage</strong> &middot; ' + washes + ' lavages par bidon';
      row.insertAdjacentElement('afterend', p);
    }
    var name = (root.querySelector('.pd-name') || {}).textContent || '';
    var bar = document.createElement('div');
    bar.className = 'pd-sticky';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<div class="pd-sticky-info"><span class="pd-sticky-name">' + name + '</span>'
      + '<span class="pd-sticky-price">' + (price ? price.toFixed(2).replace('.', ',') + ' &euro;' : '') + '</span></div>'
      + '<button type="button" class="pd-sticky-btn">Ajouter au panier</button>';
    document.body.appendChild(bar);
    bar.querySelector('button').addEventListener('click', function () { btn.click(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) {
        var visible = e[0].isIntersecting;
        bar.classList.toggle('show', !visible && e[0].boundingClientRect.top < 0);
        bar.setAttribute('aria-hidden', visible ? 'true' : 'false');
      }).observe(btn);
    }
  }
  var mo = new MutationObserver(run);
  function start() { run(); mo.observe(document.getElementById('productDetailContainer') || document.body, { childList: true, subtree: true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
