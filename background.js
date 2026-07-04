chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.create({
    id: 'copy-as-markdown',
    title: 'Copy as Markdown',
    contexts: ['page', 'selection']
  });
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId !== 'copy-as-markdown') return;
  if (!tab || !tab.id) return;
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['turndown.js', 'turndown-plugin-gfm.js', 'Readability.js', 'Readability-readerable.js', 'is-article.js', 'setup-turndown.js', 'context-menu-convert.js']
  }).catch(function () {
    // Injection fails on restricted pages (chrome://, Web Store, PDFs)
  });
});
