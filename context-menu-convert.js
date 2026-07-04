(function () {
  var selection = window.getSelection();
  var html;

  if (selection && selection.rangeCount > 0 && selection.toString().trim() !== '') {
    var container = document.createElement('div');
    for (var i = 0; i < selection.rangeCount; i++) {
      container.appendChild(selection.getRangeAt(i).cloneContents());
    }
    html = container.innerHTML;
  } else {
    html = document.documentElement.outerHTML;
  }

  var turndownService = setupTurndown();
  var markdown = turndownService.turndown(html);
  navigator.clipboard.writeText(markdown).catch(function () {
    // Clipboard write can fail on pages with restrictive Permissions-Policy
  });
})();
