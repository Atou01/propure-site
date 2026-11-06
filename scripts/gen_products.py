#!/usr/bin/env python3
"""Génère une page statique par produit (SEO) à partir de product.html + scripts/products.json,
puis régénère le sitemap. Lancer depuis la racine du site : python3 scripts/gen_products.py"""
import json, html, re, datetime
BASE = "https://www.p-pure.com"
tpl = open("product.html", encoding="utf-8").read()
products = [p for p in json.load(open("scripts/products.json", encoding="utf-8")) if p.get("launch", True)]
today = datetime.date.today().isoformat()
e = lambda s: html.escape(s, quote=True)
for p in products:
    url = f"{BASE}/{p['handle']}.html"
    ld = {"@context": "https://schema.org", "@type": "Product", "name": p["title"], "image": [p["image"]],
          "description": p["seo_description"], "sku": p["sku"], "brand": {"@type": "Brand", "name": "Pro Pure"},
          "category": "Lessive liquide" if p.get("type","Lessive")=="Lessive" else "Adoucissant",
          "offers": {"@type": "Offer", "url": url, "priceCurrency": "EUR", "price": p["price"],
                     "availability": "https://schema.org/InStock" if p["in_stock"] else "https://schema.org/OutOfStock",
                     "itemCondition": "https://schema.org/NewCondition",
                     "seller": {"@type": "Organization", "name": "Pro Pure"}}}
    crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Accueil", "item": BASE + "/"},
        {"@type": "ListItem", "position": 2, "name": "Catalogue", "item": BASE + "/catalogue.html"},
        {"@type": "ListItem", "position": 3, "name": p["title"], "item": url}]}
    s = tpl
    s = re.sub(r"<title>.*?</title>", f"<title>{e(p['seo_title'])}</title>", s, count=1)
    s = re.sub(r'<meta name="description"[^>]*/>', f'<meta name="description" content="{e(p["seo_description"])}" />', s, count=1)
    s = s.replace('<link rel="canonical" href="https://www.p-pure.com/product.html" />', f'<link rel="canonical" href="{url}" />')
    s = re.sub(r'<meta property="og:title"[^>]*/>', f'<meta property="og:title" content="{e(p["seo_title"])}" />', s, count=1)
    s = re.sub(r'<meta property="og:description"[^>]*/>', f'<meta property="og:description" content="{e(p["seo_description"])}" />\n<meta property="og:url" content="{url}" />\n<meta property="og:locale" content="fr_FR" />', s, count=1)
    s = s.replace('<meta property="og:image" content="https://www.p-pure.com/img/logo.png" />', f'<meta property="og:image" content="{e(p["image"])}" />')
    s = s.replace('<meta name="twitter:card" content="summary_large_image" />', f'<meta name="twitter:card" content="summary_large_image" />\n<meta name="twitter:title" content="{e(p["seo_title"])}" />\n<meta name="twitter:image" content="{e(p["image"])}" />')
    s = s.replace("</head>", '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>\n<script type="application/ld+json">' + json.dumps(crumbs, ensure_ascii=False) + "</script>\n</head>", 1)
    s = s.replace('<body class="product-page">', f'<body class="product-page" data-handle="{p["handle"]}">', 1)
    s = s.replace('<span class="breadcrumb-current" id="breadcrumbProduct">Chargement…</span>', f'<span class="breadcrumb-current" id="breadcrumbProduct">{e(p["title"])}</span>')
    static = (f'<div class="product-detail"><div class="product-gallery"><div class="product-gallery-main"><img src="{e(p["image"])}" alt="{e(p["title"])}" width="568" height="704" /></div></div>'
              f'<div class="product-info"><h1 class="product-title">{e(p["title"])}</h1><p>{e(p["intro"])}</p><p>{p["price"].replace(".", ",")} € – bidon de 5 L, jusqu\'à {'120' if p.get('type','Lessive')=='Lessive' else '150'} lavages, fabriqué en France.</p></div></div>')
    s = re.sub(r'<div class="product-loading".*?</div>\s*</div>', static, s, count=1, flags=re.S) if False else s.replace('<div class="product-loading" id="productLoading" role="status" aria-live="polite">\n      <div class="loading-spinner"></div>\n      <p>Chargement du produit…</p>\n    </div>', static, 1)
    open(f"{p['handle']}.html", "w", encoding="utf-8").write(s)
    print("écrit", p["handle"] + ".html")
# sitemap
sm = open("sitemap.xml", encoding="utf-8").read()
sm = re.sub(r"\s*<url>\s*<loc>https://www.p-pure.com/(?:lessive|adoucissant)-[^<]*</loc>.*?</url>", "", sm, flags=re.S)
add = "".join(f"\n  <url>\n    <loc>{BASE}/{p['handle']}.html</loc>\n    <lastmod>{today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>" for p in products)
sm = sm.replace("</urlset>", add + "\n</urlset>")
sm = re.sub(r"(<loc>https://www.p-pure.com/(?:|catalogue.html)</loc>\s*<lastmod>)[^<]*", r"\g<1>" + today, sm)
open("sitemap.xml", "w", encoding="utf-8").write(sm)

# liste des pages statiques dans le JS
js = open("js/shopify.js", encoding="utf-8").read()
js = re.sub(r"var STATIC_PRODUCT_HANDLES = \[.*?\];", "var STATIC_PRODUCT_HANDLES = " + json.dumps([p["handle"] for p in products]) + ";", js)
open("js/shopify.js", "w", encoding="utf-8").write(js)
