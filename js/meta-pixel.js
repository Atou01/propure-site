/* Meta Pixel (Pro Pure) — chargé uniquement après consentement cookies. */
(function () {
  var PIXEL_ID = '1790998372182548';
  var loaded = false;

  function consent() {
    try { return localStorage.getItem('cookieConsent') === 'accepted'; } catch (e) { return false; }
  }

  function track(name, data) {
    if (loaded && window.fbq) window.fbq('track', name, data || {});
  }

  function loadPixel() {
    if (loaded) return;
    loaded = true;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
    var p = location.pathname;
    if (/(lessive|adoucissant)-.*\.html$|product\.html$/.test(p)) {
      window.fbq('track', 'ViewContent', {
        content_name: document.title.split('|')[0].trim(),
        content_type: 'product',
        currency: 'EUR'
      });
    }
  }

  // Ajout au panier et début de paiement (fonctions définies dans shopify.js)
  function wrap(name, fn) {
    var orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      try { fn.apply(null, arguments); } catch (e) {}
      return orig.apply(this, arguments);
    };
  }

  function init() {
    wrap('addToCart', function (variantId, title, price) {
      track('AddToCart', {
        content_name: title,
        content_ids: variantId ? [String(variantId)] : [],
        content_type: 'product',
        value: parseFloat(price) || 0,
        currency: 'EUR'
      });
    });
    wrap('goToCheckout', function () { track('InitiateCheckout', { currency: 'EUR' }); });

    // Suit le choix du bandeau cookies
    var origConsent = window.setCookieConsent;
    if (typeof origConsent === 'function') {
      window.setCookieConsent = function (accepted) {
        var r = origConsent.apply(this, arguments);
        if (accepted) loadPixel();
        return r;
      };
    }
    if (consent()) loadPixel();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
