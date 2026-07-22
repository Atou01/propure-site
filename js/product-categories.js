(function(root, factory) {
  var api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.ProPureProductCategories = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  var CATEGORY_LABELS = {
    all: 'Tous les produits',
    lessives: 'Lessives',
    adoucissants: 'Adoucissants',
    'nettoyants-sols': 'Nettoyants sols',
    'liquides-vaisselle': 'Liquides vaisselle',
    'sprays-entretien': "Sprays d'entretien"
  };

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’']/g, ' ')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function includesAny(value, terms) {
    return terms.some(function(term) {
      return value.includes(term);
    });
  }

  function classifyProduct(product) {
    product = product || {};
    var type = normalize(product.productType);
    var title = normalize(product.title);
    var tags = normalize(Array.isArray(product.tags) ? product.tags.join(' ') : product.tags);
    var haystack = [type, title, tags].join(' ');

    // Classer les familles précises avant les produits d'entretien génériques.
    if (includesAny(type, ['liquide vaisselle', 'liquides vaisselle', 'vaisselle', 'dish soap']) ||
        includesAny(haystack, ['liquide vaisselle', 'gel vaisselle'])) {
      return 'liquides-vaisselle';
    }

    if (includesAny(type, ['nettoyant sol', 'nettoyants sols', 'nettoyant sols', 'sols', 'floor cleaner']) ||
        includesAny(haystack, ['nettoyant sol', 'nettoyant pour sol'])) {
      return 'nettoyants-sols';
    }

    if (includesAny(type, ['adoucissant', 'adoucisant', 'fabric softener']) ||
        includesAny(haystack, ['adoucissant', 'adoucisant'])) {
      return 'adoucissants';
    }

    if (includesAny(type, ['lessive', 'laundry detergent']) ||
        includesAny(haystack, ['lessive liquide', 'lessive concentree'])) {
      return 'lessives';
    }

    if (includesAny(type, ['spray entretien', 'sprays entretien', 'produit entretien', 'entretien']) ||
        includesAny(haystack, ['spray entretien', 'anticalcaire', 'degraiss clean', 'degraissant', 'vitres anti buee', 'nettoyant vitres'])) {
      return 'sprays-entretien';
    }

    return 'other';
  }

  return {
    labels: CATEGORY_LABELS,
    normalize: normalize,
    classifyProduct: classifyProduct
  };
});
