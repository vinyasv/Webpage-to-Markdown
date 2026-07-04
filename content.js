chrome.runtime.sendMessage({
  action: "getSourceHtml",
  source: document.documentElement.outerHTML
}); 