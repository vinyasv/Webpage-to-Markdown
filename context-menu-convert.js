(function () {
  var selection = window.getSelection();
  var hasSelection = selection && selection.rangeCount > 0 && selection.toString().trim() !== '';

  function getSelectionHtml() {
    var container = document.createElement('div');
    for (var i = 0; i < selection.rangeCount; i++) {
      container.appendChild(selection.getRangeAt(i).cloneContents());
    }
    return container.innerHTML;
  }

  // Article extraction via Readability; null when the page isn't article-shaped.
  function getReadableHtml() {
    try {
      if (typeof Readability === 'undefined') return null;
      // Only extract when the page is a genuine article (see is-article.js);
      // otherwise fall back to the full page (feeds, e-comm, dashboards...).
      if (typeof isArticlePage === 'function' && !isArticlePage(document)) {
        return null;
      }
      var article = new Readability(document.cloneNode(true)).parse();
      if (article && article.content && article.content.trim()) {
        // Prepend the (separately-returned) title as an H1 so the article
        // isn't headless.
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
      // Fall back to the full page.
    }
    return null;
  }

  function convert(html) {
    var markdown = setupTurndown().turndown(html);
    navigator.clipboard.writeText(markdown).catch(function () {
      // Clipboard write can fail on pages with restrictive Permissions-Policy
    });
  }

  // A selection is always converted verbatim; only full-page uses article mode.
  if (hasSelection) {
    convert(getSelectionHtml());
    return;
  }

  chrome.storage.sync.get({ articleMode: false }, function (opts) {
    var html = opts.articleMode ? getReadableHtml() : null;
    convert(html || document.documentElement.outerHTML);
  });
})();
