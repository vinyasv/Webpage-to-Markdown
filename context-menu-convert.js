(function () {
  // The right-click menu has no UI to choose article mode, so it always converts
  // the selection (if any) or the full page — same as the popup with the toggle
  // off. Article extraction is a popup-only, opt-in choice.
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

  var markdown = setupTurndown().turndown(html);
  navigator.clipboard.writeText(markdown).catch(function () {
    // Clipboard write can fail on pages with restrictive Permissions-Policy
  });
})();
