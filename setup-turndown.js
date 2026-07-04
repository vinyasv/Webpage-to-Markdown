function setupTurndown() {
  var turndownService = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '*',
    codeBlockStyle: 'fenced',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    linkReferenceStyle: 'full',
    preformattedCode: true,
    blankReplacement: function (content, node) {
      if (node.isBlock && node.nodeName !== 'PRE') return '\n\n';
      return '';
    },
    keep: function (node) {
      return node.nodeName === 'PRE' || node.nodeName === 'CODE';
    }
  });

  turndownService.remove(['script', 'style', 'iframe', 'noscript', 'form', 'nav', 'footer', 'aside']);

  turndownService.remove(function (node) {
    var style = typeof window !== 'undefined' ? window.getComputedStyle(node) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) {
      return true;
    }
    return node.getAttribute('aria-hidden') === 'true';
  });

  turndownService.remove(function (node) {
    return node.isBlock && node.textContent.trim() === '' && !node.querySelector('img, pre, code, table, hr, li, blockquote, audio, video');
  });

  turndownService.addRule('commonPopupsAndOverlays', {
    filter: function (node) {
      var role = node.getAttribute('role');
      if (role === 'dialog' || role === 'alertdialog' || role === 'banner' || role === 'alert' || role === 'status' || role === 'log' || role === 'tooltip' || role === 'menu') {
        return true;
      }

      var id = node.id ? node.id.toLowerCase() : '';
      if (id.includes('cookie') || id.includes('consent') || id.includes('modal') || id.includes('popup') || id.includes('overlay') || id.includes('banner')) {
        return true;
      }

      for (var i = 0; i < node.attributes.length; i++) {
        var attrName = node.attributes[i].name.toLowerCase();
        var attrValue = node.attributes[i].value.toLowerCase();
        if (attrName.startsWith('data-') && (attrName.includes('modal') || attrName.includes('popup') || attrName.includes('overlay') || attrName.includes('banner') || attrName.includes('consent') || attrName.includes('cookie') || attrName.includes('toast') || attrName.includes('dialog'))) {
          return true;
        }
        if (attrName === 'class' && (attrValue.includes('modal') || attrValue.includes('popup') || attrValue.includes('overlay') || attrValue.includes('consent') || attrValue.includes('cookie') || attrValue.includes('banner') || attrValue.includes('toast'))) {
          if (node.nodeName === 'DIV') return true;
        }
      }
      return false;
    },
    replacement: function () {
      return '';
    }
  });

  turndownService.addRule('images', {
    filter: 'img',
    replacement: function (content, node) {
      var alt = node.alt || '';
      var src = node.getAttribute('src') || '';
      if (!src || src.startsWith('data:')) {
        return '';
      }
      try {
        src = new URL(src, document.baseURI).href;
      } catch (e) {
        // Keep src as-is if URL resolution fails
      }
      if (src) {
        return '![' + alt + '](' + src + ')';
      }
      return '';
    }
  });

  turndownService.addRule('trackingImages', {
    filter: function (node) {
      if (node.nodeName === 'IMG') {
        var src = node.getAttribute('src');
        if (src && (src.includes('pixel') || src.includes('track') || src.includes('trace') || src.includes('beacon') || src.startsWith('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'))) {
          return true;
        }
        var width = node.getAttribute('width');
        var height = node.getAttribute('height');
        if ((width === '1' && height === '1') || (width === '0' && height === '0')) {
          return !src || !src.toLowerCase().endsWith('.svg');
        }
      }
      return false;
    },
    replacement: function () {
      return '';
    }
  });

  return turndownService;
}
