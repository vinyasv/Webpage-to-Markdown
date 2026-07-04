// Regression tests for table conversion (turndown + turndown-plugin-gfm + our
// fixTableRules overrides in setup-turndown.js).
//
//   npm test
//
// Guards the three fixes on top of the GFM plugin: pipe escaping, intra-cell
// newlines -> <br>, and header-less tables converting instead of dumping raw
// HTML. Assertions are on the emitted Markdown string (no extra deps).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'https://example.com' });
const sandbox = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, console };
vm.createContext(sandbox);
for (const f of ['turndown.js', 'turndown-plugin-gfm.js', 'setup-turndown.js']) {
  vm.runInContext(read(f), sandbox, { filename: f });
}
const td = sandbox.setupTurndown();
const toMd = html => td.turndown(html);

let failed = 0;
function ok(label, cond, detail) {
  if (!cond) { failed++; console.log(`FAIL  ${label}${detail ? '  -> ' + detail : ''}`); }
  else console.log(`PASS  ${label}`);
}

// 1. Basic table converts with header + separator.
{
  const md = toMd(`<table><thead><tr><th>Name</th><th>Role</th></tr></thead><tbody><tr><td>Ada</td><td>Eng</td></tr></tbody></table>`);
  ok('basic: header row', md.includes('| Name | Role |'), md);
  ok('basic: separator row', md.includes('| --- | --- |'), md);
  ok('basic: data row', md.includes('| Ada | Eng |'), md);
}

// 2. Header-less table converts (no raw HTML), first row promoted.
{
  const md = toMd(`<table><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></table>`);
  ok('headerless: no raw <table>', !/<table/i.test(md), md);
  ok('headerless: has separator', md.includes('| --- | --- |'), md);
  ok('headerless: promoted first row', md.includes('| 1 | 2 |') && md.includes('| 3 | 4 |'), md);
}

// 3. Pipe inside a cell is escaped so it can't split the row.
{
  const md = toMd(`<table><thead><tr><th>Expr</th><th>M</th></tr></thead><tbody><tr><td>a | b</td><td>OR</td></tr></tbody></table>`);
  ok('pipe: escaped as \\|', md.includes('a \\| b'), md);
  ok('pipe: data row has exactly 2 columns', /\n\| a \\\| b \| OR \|/.test(md), md);
}

// 4. Intra-cell newlines (<br>, block content) become <br>, never a row break.
{
  const md = toMd(`<table><thead><tr><th>Item</th><th>Detail</th></tr></thead><tbody><tr><td>Steps</td><td>line1<br>line2</td></tr></tbody></table>`);
  ok('br: single-line cell with <br>', /\| Steps \| line1\s*<br>line2 \|/.test(md), md);
  // The table must be exactly 3 lines (header, separator, one data row).
  ok('br: no extra rows introduced', md.trim().split('\n').length === 3, JSON.stringify(md));
}

// 5. Multi-paragraph cell collapses to <br>, stays one row.
{
  const md = toMd(`<table><thead><tr><th>K</th><th>V</th></tr></thead><tbody><tr><td>Para</td><td><p>one</p><p>two</p></td></tr></tbody></table>`);
  ok('paragraphs: joined with <br>', md.includes('| Para | one<br>two |'), md);
  ok('paragraphs: no row split', md.trim().split('\n').length === 3, JSON.stringify(md));
}

// 6. Alignment from align attribute preserved.
{
  const md = toMd(`<table><thead><tr><th align="left">L</th><th align="center">C</th><th align="right">R</th></tr></thead><tbody><tr><td>a</td><td>b</td><td>c</td></tr></tbody></table>`);
  ok('align: left/center/right markers', md.includes('| :-- | :-: | --: |'), md);
}

// 7. Inline markup inside cells survives.
{
  const md = toMd(`<table><thead><tr><th>H</th></tr></thead><tbody><tr><td><strong>Bold</strong> <a href="https://x.com">lnk</a> <code>c</code></td></tr></tbody></table>`);
  ok('inline: bold', md.includes('**Bold**'), md);
  ok('inline: link', md.includes('[lnk](https://x.com)'), md);
  ok('inline: code', md.includes('`c`'), md);
}

// 8. Caption sits on its own line, separated from the grid by a blank line.
{
  const md = toMd(`<table><caption>My Caption</caption><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>`);
  ok('caption: text present', md.includes('My Caption'), md);
  ok('caption: blank line before table', /My Caption\n\n\| A \| B \|/.test(md), JSON.stringify(md));
}

// 9. Single-cell "layout" table is left alone (not forced into a 1x1 grid).
{
  const md = toMd(`<table><tr><td>just layout</td></tr></table>`);
  ok('layout: single-cell not turned into a table grid', !/\| --- \|/.test(md), md);
}

console.log(`\n${failed === 0 ? 'ALL TABLE TESTS PASSED' : failed + ' FAILURE(S)'}`);
process.exit(failed ? 1 : 0);
