// Regression tests for isArticlePage() — the predicate that decides whether the
// "Article only" toggle appears and whether Readability extraction runs.
//
//   npm test
//
// Uses small synthetic fixtures, one per detection branch, so the behaviour that
// separates real articles from feeds/shops/dashboards stays locked. Mirrors the
// findings from the real pages we checked (jamesclear, wikipedia, substack).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function isArticlePage(html) {
  const { window } = new JSDOM(html, { url: 'https://example.com/x' });
  const sandbox = { window, document: window.document, navigator: window.navigator, console };
  vm.createContext(sandbox);
  for (const f of ['Readability-readerable.js', 'is-article.js']) {
    vm.runInContext(read(f), sandbox, { filename: f });
  }
  return sandbox.isArticlePage(window.document);
}

// A block of real prose long enough to pass Readability's density gate, so the
// "dense but no article signal" cases exercise the signal requirement itself.
const prose = '<p>' + ('This is a full sentence of genuine article body text that carries enough words to satisfy the readability density threshold used by the detector. ').repeat(4) + '</p>';
const body = prose + prose + prose;

const cases = [
  ['og:type=article',            `<html><head><meta property="og:type" content="article"></head><body>${body}</body></html>`, true],
  ['JSON-LD Article',            `<html><head><script type="application/ld+json">{"@type":"Article"}</script></head><body>${body}</body></html>`, true],
  ['JSON-LD NewsArticle array',  `<html><head><script type="application/ld+json">{"@type":["NewsArticle"]}</script></head><body>${body}</body></html>`, true],
  ['JSON-LD BlogPosting',        `<html><head><script type="application/ld+json">{"@type":"BlogPosting"}</script></head><body>${body}</body></html>`, true],
  ['microdata Article',          `<html><body itemscope itemtype="https://schema.org/Article">${body}</body></html>`, true],
  ['single dominant <article>',  `<html><body><header><a href="/">Home</a></header><article>${body}</article></body></html>`, true],
  // Negative cases — the ones that motivated all this.
  ['dense feed, no signal (Substack-style)', `<html><head><script type="application/ld+json">{"@type":"Person"}</script></head><body><main>${body}${body}</main></body></html>`, false],
  ['e-commerce grid (not dense)', `<html><head><title>Shop</title></head><body>${Array.from({length:20},(_,i)=>`<div class="card"><a href="/p/${i}">Product ${i}</a><span>$${i}.99</span></div>`).join('')}</body></html>`, false],
];

let failed = 0;
for (const [label, html, expected] of cases) {
  let got;
  try { got = isArticlePage(html); }
  catch (e) { got = 'THREW: ' + e.message; }
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (got ${got}, expected ${expected})`);
}

console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
