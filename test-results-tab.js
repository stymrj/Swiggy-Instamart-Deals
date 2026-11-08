// Regression test for the blank-results bug class (Swiggy Instamart v2).
// Loads the real fetch+parse section out of src/deals.js, feeds it an
// Instamart cards payload and a category-listing payload, and checks every
// parsed product carries the fields the results tab needs to render a card
// — then counts the cards that would render. Parser drops / malformed items
// are exactly how fetched deals used to vanish from the results tab.
// Run: node test-results-tab.js   (from this repo root)
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'src', 'deals.js'), 'utf8');
const start = src.indexOf('// ── v2 Instamart fetch+parse ──');
const end = src.indexOf('// ── end v2 Instamart fetch+parse ──');
if (start < 0 || end < 0) throw new Error('v2 fetch+parse section not found in src/deals.js');
const section = src.slice(start, end);

// Stubs for the browser globals the section touches at definition time only.
const price = v => { if (v == null) return 0; if (typeof v === 'number') return v; const m = String(v).replace(/,/g, '').match(/\d+(\.\d+)?/); return m ? +m[0] : 0; };
const guessBrand = t => (String(t).trim().split(/\s+/)[0] || '').replace(/[^\w&'-]/g, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const W = {};
global.window = {};
global.document = { cookie: '', title: 'Instamart' };
global.location = { search: '', hash: '', href: 'https://www.swiggy.com/instamart' };
global.performance = { getEntries: () => [] };
global.localStorage = { getItem: () => null, setItem() {}, length: 0, key: () => null };
global.sessionStorage = { getItem: () => null, length: 0, key: () => null };
eval(section);

const cardsFixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sample-api.json'), 'utf8'));
const listingFixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sample-listing.json'), 'utf8'));

// 1. Cards payload: 8 variations in the fixture — 1 out of stock and 1 with
//    no price are skipped, so 6 must parse (incl. the zero-discount sugar,
//    which the results tab filters by min discount, not the parser).
const cards = parseInstamartCards(cardsFixture, 'Atta, Rice & Dals', 'Atta');
console.log('Cards parsed:', cards.length, '(expected 6)');
console.log('Cards titles:', cards.map(p => p.title).join(' | '));
console.log('First card discount 24%?', cards[0] && cards[0].disc === 24);
console.log('Nanos price read as 112.5?', cards.some(p => p.id === 's-dal' && p.price === 112.5));

// 2. Category-listing payload: 2 items, both must parse.
const listing = parseInstamartCards(listingFixture, 'Atta, Rice & Dals', 'Rice');
console.log('Listing parsed:', listing.length, '(expected 2)');

// 3. Built-in self-test (same code the sidebar button runs in-browser).
const selfTest = runSelfTest();
console.log('Self-test:', JSON.stringify(selfTest));

// 4. Empty-state diagnostics.
const diagCases = [
  [diagnoseInstamartEmpty({ status: 429, items: 0 }), 'rate-limited'],
  [diagnoseInstamartEmpty({ status: 401, items: 0 }), 'logged-out'],
  [diagnoseInstamartEmpty({ status: 200, items: 0, hasStore: false }), 'no-store'],
  [diagnoseInstamartEmpty({ status: 200, items: 0, hasStore: true }), 'category-empty'],
  [diagnoseInstamartEmpty({ status: 200, items: 3 }), 'ok']
];
console.log('Diagnostics:', diagCases.map(([got, want]) => got + '==' + want + ':' + (got === want)).join(', '));
const diagOk = diagCases.every(([got, want]) => got === want);

// 5. Render check: every parsed item must carry the fields card() needs,
//    and one card must render per parsed item (the blank-results guard).
const all = cards.concat(listing);
const bad = all.filter(p => !p.id || !p.title || !(p.price > 0) || p.mrp < p.price || p.disc == null || !/^https:\/\/media-assets\.swiggy\.com\//.test(p.img) || !/^https:\/\/www\.swiggy\.com\/instamart\/search\?/.test(p.url));
console.log('Items missing a card field:', bad.length);
const rendered = all.map(p => `<article class="card"><div class="im" style="background-image:url('${p.img}')"><span class="dc">${p.disc}% OFF</span></div><div class="inf"><a class="ti" href="${p.url}">${p.title}</a><div class="pr"><b>₹${p.price}</b><s>₹${p.mrp}</s></div></div></article>`);
console.log('Cards rendered:', rendered.length, 'of', all.length, 'parsed items');
const jsonOut = toJsonExport(cards.slice(0, 1));
console.log('JSON export parses?', JSON.parse(jsonOut).length === 1 && JSON.parse(jsonOut)[0].discountPct === cards[0].disc);

if (cards.length === 6 && listing.length === 2 && selfTest.pass && diagOk && bad.length === 0 && rendered.length === all.length) {
  console.log('PASS: Instamart v2 parser renders 8/8 cards (cards 6 + listing 2) + self-test PASS + diagnostics 5/5');
} else {
  console.log('FAIL: expected cards 6, listing 2, self-test PASS, diagnostics 5/5, 0 bad items, 8 cards');
  process.exit(1);
}
