// Shared predicate: is the current page a single readable article (as opposed to
// a feed, social timeline, search page, dashboard, or shop)? Used both to decide
// whether to show the "Article only" toggle and whether to actually run
// Readability extraction, so the UI and the conversion always agree.
//
// Strategy: a density gate (Readability's own isProbablyReaderable) AND at least
// one positive "this is an article" signal. Text density alone is not enough —
// a busy comment feed is dense too — so we require an explicit article marker.
function isArticlePage(doc) {
  doc = doc || document;

  // Density gate: pages without enough article-like text never qualify.
  if (typeof isProbablyReaderable === 'function' && !isProbablyReaderable(doc)) {
    return false;
  }

  // 1) Open Graph: <meta property="og:type" content="article">.
  var og = doc.querySelector('meta[property="og:type"], meta[name="og:type"]');
  if (og && /article/i.test(og.getAttribute('content') || '')) {
    return true;
  }

  // 2) schema.org Article family via JSON-LD (Article, NewsArticle,
  //    BlogPosting, ScholarlyArticle, ...). Handles string and array @type.
  var ld = doc.querySelectorAll('script[type="application/ld+json"]');
  for (var i = 0; i < ld.length; i++) {
    if (/"@type"\s*:\s*\[?\s*"[A-Za-z]*(?:Article|BlogPosting)/i.test(ld[i].textContent || '')) {
      return true;
    }
  }

  // 3) Microdata: itemtype=".../Article".
  if (doc.querySelector('[itemtype*="Article" i]')) {
    return true;
  }

  // 4) A single <article> element that dominates the page's text (covers
  //    article pages that ship no metadata but use semantic HTML). Multiple
  //    <article> elements indicate a feed/listing, so that does not qualify.
  var articles = doc.querySelectorAll('article');
  if (articles.length === 1) {
    var articleLen = (articles[0].textContent || '').replace(/\s+/g, ' ').trim().length;
    var bodyEl = doc.body;
    var bodyLen = bodyEl ? (bodyEl.textContent || '').replace(/\s+/g, ' ').trim().length : 0;
    if (bodyLen > 0 && articleLen / bodyLen > 0.4) {
      return true;
    }
  }

  return false;
}

if (typeof module === 'object') {
  module.exports = isArticlePage; // for tests
}
