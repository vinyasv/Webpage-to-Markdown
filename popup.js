document.addEventListener('DOMContentLoaded', function () {
  const convertToMarkdownBtn = document.getElementById('convertToMarkdownBtn');
  const copyMarkdownBtn = document.getElementById('copyMarkdownBtn');
  const downloadMarkdownBtn = document.getElementById('downloadMarkdownBtn');
  const markdownOutputPre = document.getElementById('markdownOutput');

  const initialView = document.getElementById('initialView');
  const convertingView = document.getElementById('convertingView');
  const convertedView = document.getElementById('convertedView');

  const copyButtonText = document.getElementById('copyButtonText');
  const copyIconClipboard = document.getElementById('copyIconClipboard');
  const copyIconCheck = document.getElementById('copyIconCheck');

  const infoText = document.getElementById('infoText');
  const articleModeRow = document.getElementById('articleModeRow');
  const articleModeToggle = document.getElementById('articleModeToggle');

  // Reflect the saved preference and persist changes. Defaults OFF so existing
  // users keep today's full-page behavior; the toggle is opt-in. content.js
  // reads the same key from chrome.storage when it runs in the page.
  chrome.storage.sync.get({ articleMode: false }, function (opts) {
    articleModeToggle.checked = opts.articleMode;
  });
  articleModeToggle.addEventListener('change', function () {
    chrome.storage.sync.set({ articleMode: articleModeToggle.checked });
  });

  // The "Article only" toggle only makes sense on article-shaped pages. Probe the
  // active tab with Readability's detector and reveal the toggle only when it
  // applies; on feeds, shops, dashboards (or restricted pages) it stays hidden.
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs || tabs.length === 0) return;
    const tabId = tabs[0].id;
    chrome.scripting.executeScript(
      { target: { tabId: tabId }, files: ['Readability-readerable.js', 'is-article.js'] },
      function () {
        if (chrome.runtime.lastError) return; // restricted page; leave hidden
        chrome.scripting.executeScript(
          {
            target: { tabId: tabId },
            func: function () {
              return typeof isArticlePage === 'function'
                ? isArticlePage(document)
                : false;
            }
          },
          function (results) {
            if (chrome.runtime.lastError) return;
            if (results && results[0] && results[0].result) {
              articleModeRow.classList.remove('hidden');
            }
          }
        );
      }
    );
  });

  let pageTitle = 'page';
  let turndownService;
  try {
    turndownService = setupTurndown();
  } catch (e) {
    console.error("TurndownService not available or failed to initialize:", e);
    initialView.classList.add('hidden');
    convertingView.classList.add('hidden');
    convertedView.classList.remove('hidden');
    markdownOutputPre.textContent = "Error: Could not initialize Markdown converter. Make sure turndown.js is loaded.";
    copyMarkdownBtn.disabled = true;
    infoText.textContent = "Conversion failed.";
    return;
  }

  // Function to update UI state
  function updateState(newState) {
    initialView.classList.add('hidden');
    convertingView.classList.add('hidden');
    convertedView.classList.add('hidden');
    copyIconClipboard.classList.remove('hidden');
    copyIconCheck.classList.add('hidden');
    copyButtonText.textContent = 'Copy Markdown';

    if (newState === 'initial') {
      initialView.classList.remove('hidden');
      infoText.textContent = 'Click to convert the current page';
    } else if (newState === 'converting') {
      convertingView.classList.remove('hidden');
      infoText.textContent = 'Processing page content...';
    } else if (newState === 'converted') {
      convertedView.classList.remove('hidden');
      infoText.textContent = 'Markdown ready to use!';
    }
  }

  convertToMarkdownBtn.addEventListener('click', function () {
    updateState('converting');

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || tabs.length === 0) {
        console.error('No active tab found.');
        markdownOutputPre.textContent = 'Error: No active tab found.';
        updateState('converted');
        copyMarkdownBtn.disabled = true;
        return;
      }
      pageTitle = tabs[0].title || 'page';
      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          files: ['Readability.js', 'Readability-readerable.js', 'is-article.js', 'content.js']
        },
        () => {
          if (chrome.runtime.lastError) {
            console.error('Script injection failed: ' + chrome.runtime.lastError.message);
            markdownOutputPre.textContent = 'Error: Could not access page content. ' + chrome.runtime.lastError.message;
            updateState('converted');
            copyMarkdownBtn.disabled = true;
            return;
          }
        }
      );
    });
  });

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "getSourceHtml") {
      if (!turndownService) {
        console.error("TurndownService is not initialized.");
        markdownOutputPre.textContent = "Error: Markdown converter is not ready.";
        updateState('converted');
        copyMarkdownBtn.disabled = true;
        return;
      }
      try {
        const markdown = turndownService.turndown(request.source);
        markdownOutputPre.textContent = markdown; 
        copyMarkdownBtn.disabled = false;
      } catch (e) {
        console.error("Error converting HTML to Markdown:", e);
        markdownOutputPre.textContent = "Error during Markdown conversion: " + e.message;
        copyMarkdownBtn.disabled = true;
      }
      updateState('converted');
    }
  });

  copyMarkdownBtn.addEventListener('click', function () {
    if (markdownOutputPre.textContent) {
      navigator.clipboard.writeText(markdownOutputPre.textContent)
        .then(() => {
          copyButtonText.textContent = 'Copied!';
          copyIconClipboard.classList.add('hidden');
          copyIconCheck.classList.remove('hidden');
          
          setTimeout(() => {
            copyButtonText.textContent = 'Copy Markdown';
            copyIconClipboard.classList.remove('hidden');
            copyIconCheck.classList.add('hidden');
          }, 2000);
        })
        .catch(err => {
          console.error('Failed to copy: ', err);
          copyButtonText.textContent = 'Copy Failed';
           setTimeout(() => {
            copyButtonText.textContent = 'Copy Markdown';
          }, 2000);
        });
    }
  });

  downloadMarkdownBtn.addEventListener('click', function () {
    const text = markdownOutputPre.textContent;
    if (!text) return;
    const filename = pageTitle.replace(/[<>:"/\\|?*]/g, '').trim().substring(0, 100) || 'page';
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.md';
    a.click();
    URL.revokeObjectURL(url);
  });

  updateState('initial');
}); 