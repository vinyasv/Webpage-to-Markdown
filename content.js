(function () {
  // Try Mozilla Readability (the library behind Firefox Reader View) to isolate
  // the main article, stripping nav/sidebars/related-posts. Returns null when the
  // page isn't article-shaped so we can fall back to the full page.
  function getReadableHtml() {
    try {
      if (typeof Readability === 'undefined') return null;
      // Only extract when the page is a genuine article (see is-article.js).
      // Feeds, shopping/search results and dashboards fail this check, so we
      // fall back to the full page instead of trusting a bad extraction.
      if (typeof isArticlePage === 'function' && !isArticlePage(document)) {
        return null;
      }
      var article = new Readability(document.cloneNode(true)).parse();
      if (article && article.content && article.content.trim()) {
        // Readability returns the title separately from the body, so prepend it
        // as an H1 (safely, via textContent) to avoid a headless article.
        var wrapper = document.createElement('div');
        if (article.title && article.title.trim()) {
          var h1 = document.createElement('h1');
          h1.textContent = article.title.trim();
          wrapper.appendChild(h1);
        }
        var body = document.createElement('div');
        body.innerHTML = article.content;
        wrapper.appendChild(body);
        return wrapper.innerHTML;
      }
    } catch (e) {
      // Readability can throw on unusual DOMs; fall back to full page.
    }
    return null;
  }

  function send(html) {
    chrome.runtime.sendMessage({ action: "getSourceHtml", source: html });
  }

  // The popup stashes the toggle state on the shared isolated-world global just
  // before injecting this script. Defaults to full page when unset.
  var articleMode = window.__wtmArticleMode === true;
  var html = articleMode ? getReadableHtml() : null;
  send(html || document.documentElement.outerHTML);
})();
