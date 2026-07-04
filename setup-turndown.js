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

  // GitHub Flavored Markdown: tables, strikethrough, task lists.
  // Without this, tables are silently dropped by base Turndown.
  if (typeof turndownPluginGfm !== 'undefined' && turndownPluginGfm.gfm) {
    turndownService.use(turndownPluginGfm.gfm);
    fixTableRules(turndownService);
  }

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

// Repairs three shortcomings of turndown-plugin-gfm's table rules:
//   1. "|" inside a cell isn't escaped, so it splits the row into phantom cells.
//   2. Block content (<br>, multiple <p>, nested tables) emits raw newlines,
//      which terminate the Markdown row.
//   3. Tables with no <th> heading row aren't converted at all (dumped as raw
//      HTML); we promote the first row to a header instead.
// Rules added here are unshifted ahead of the plugin's, so they take precedence.
function fixTableRules(turndownService) {
  var everyFn = Array.prototype.every;

  function isFirstTbody(el) {
    var prev = el.previousSibling;
    return el.nodeName === 'TBODY' && (!prev ||
      (prev.nodeName === 'THEAD' && /^\s*$/i.test(prev.textContent)));
  }

  // A real <th> heading row (mirrors the plugin's own definition).
  function isHeadingRow(tr) {
    var parent = tr.parentNode;
    return parent.nodeName === 'THEAD' ||
      (parent.firstChild === tr &&
        (parent.nodeName === 'TABLE' || isFirstTbody(parent)) &&
        everyFn.call(tr.childNodes, function (n) { return n.nodeName === 'TH'; }));
  }

  function tableOf(tr) {
    var n = tr.parentNode;
    while (n && n.nodeName !== 'TABLE') n = n.parentNode;
    return n;
  }

  function isSingleCellTable(table) {
    return table.rows.length === 1 && table.rows[0].cells.length <= 1;
  }

  // The row that supplies the Markdown header: a real heading row, or the first
  // row of a table that has none (which we promote so the table can convert).
  function isEffectiveHeadingRow(tr) {
    if (isHeadingRow(tr)) return true;
    var table = tableOf(tr);
    if (!table || !table.rows.length) return false;
    return table.rows[0] === tr && !isHeadingRow(table.rows[0]);
  }

  function sanitizeCell(content) {
    return content
      .replace(/^\n+|\n+$/g, '')  // trim edge newlines
      .replace(/\n+/g, '<br>')     // internal newlines -> <br> (valid in a cell)
      .replace(/\|/g, '\\|');      // escape pipes so they don't split the row
  }

  // Wrap cell content, marking the row's first *element* cell with a leading "|"
  // (robust to whitespace text nodes between cells).
  function cellMd(content, node) {
    var siblings = node.parentNode.childNodes;
    var isFirst = false;
    for (var i = 0; i < siblings.length; i++) {
      if (siblings[i].nodeType === 1) { isFirst = siblings[i] === node; break; }
    }
    return (isFirst ? '| ' : ' ') + content + ' |';
  }

  turndownService.addRule('tableCell', {
    filter: ['th', 'td'],
    replacement: function (content, node) {
      return cellMd(sanitizeCell(content), node);
    }
  });

  turndownService.addRule('tableRow', {
    filter: 'tr',
    replacement: function (content, node) {
      var border = '';
      if (isEffectiveHeadingRow(node)) {
        var alignMap = { left: ':--', right: '--:', center: ':-:' };
        for (var i = 0; i < node.childNodes.length; i++) {
          var child = node.childNodes[i];
          if (child.nodeType !== 1) continue; // skip whitespace text nodes
          var b = '---';
          var align = (child.getAttribute('align') || '').toLowerCase();
          if (align) b = alignMap[align] || b;
          border += cellMd(b, child);
        }
      }
      return '\n' + content + (border ? '\n' + border : '');
    }
  });

  // Render <caption> as a paragraph above the table (kept separate by a blank
  // line, which the table rule below preserves).
  turndownService.addRule('tableCaption', {
    filter: 'caption',
    replacement: function (content) {
      content = content.replace(/\s+/g, ' ').trim();
      return content ? content + '\n\n' : '';
    }
  });

  turndownService.addRule('table', {
    // Convert every real table (including header-less ones); leave trivial
    // single-cell "layout" tables to the plugin's keep (raw HTML).
    filter: function (node) {
      return node.nodeName === 'TABLE' && !isSingleCellTable(node);
    },
    replacement: function (content) {
      // Collapse only *excess* blank lines (3+), so a caption stays separated
      // from the grid while stray blanks between rows are removed.
      content = content.replace(/\n{3,}/g, '\n\n');
      return '\n\n' + content + '\n\n';
    }
  });
}
