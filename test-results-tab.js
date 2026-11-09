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

// 1. Cards payload: 8 variations in the fixture — 1 with no price is
//    skipped; the out-of-stock item is now kept, flagged inStock:false (the
//    results tab's stock toggle decides whether it shows), so 7 must parse
//    (incl. the zero-discount sugar, which the results tab filters by min
//    discount, not the parser).
const cards = parseInstamartCards(cardsFixture, 'Atta, Rice & Dals', 'Atta');
console.log('Cards parsed:', cards.length, '(expected 7)');
console.log('Cards titles:', cards.map(p => p.title).join(' | '));
console.log('Out-of-stock item kept, flagged?', cards.some(p => p.id === 's-maggi' && p.inStock === false));
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

// 6. Highest-discount fixture (2026-11-09 fix): 8 items at 85-100% off in
//    the shapes that used to drop — string prices, missing MRP + discount
//    field, fraction discount, free item, out-of-stock clearance, flat-number
//    price, max-only price. All 8 must parse, and the 100%-off item must
//    sort FIRST in the results tab.
const hdFix = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sample-high-discount.json'), 'utf8'));
const hdItems = parseInstamartCards(hdFix, 'Test', 'Atta');
console.log('High-discount parsed:', hdItems.length, '(expected 8)');
const hdSorted = hdItems.slice().sort((a, b) => b.disc - a.disc || b.save - a.save);
console.log('High-discount order:', hdSorted.map(p => p.id + ':' + p.disc).join(', '));
const hdFirstOk = hdSorted.length === 8 && hdSorted[0].id === 'im-100-free' && hdSorted[0].disc === 100 && hdSorted[1].disc === 95;
console.log('Highest-discount item renders FIRST?', hdFirstOk);
const hdOos = hdItems.find(p => p.id === 'im-90-oos');
console.log('Out-of-stock clearance item kept, flagged?', hdOos && hdOos.inStock === false && hdOos.disc === 90);
const hdBad = hdItems.filter(p => p.id !== 'im-100-free').filter(p => !p.id || !p.title || !(p.price > 0) || p.mrp < p.price || p.disc == null || !/^https:\/\/media-assets\.swiggy\.com\//.test(p.img) || !/^https:\/\/www\.swiggy\.com\/instamart\/search\?/.test(p.url));
console.log('High-discount items missing a card field (excl. ₹0 free item):', hdBad.length);
// 7. Page-2 expand gate: a full first page from an unsorted GET endpoint
//    must earn page 2 even when its last item is low-discount.
const gateFullUnsorted = imShouldExpand(Array.from({ length: 15 }, (_, i) => ({ disc: i === 14 ? 20 : 60 - i })));
const gateShort = imShouldExpand(Array.from({ length: 5 }, () => ({ disc: 90 })));
console.log('Gate: full unsorted page expands?', gateFullUnsorted, '· short page does not?', !gateShort);

if (cards.length === 7 && listing.length === 2 && selfTest.pass && diagOk && bad.length === 0 && rendered.length === all.length && hdItems.length === 8 && hdFirstOk && hdOos && hdOos.inStock === false && hdBad.length === 0 && gateFullUnsorted && !gateShort) {
  console.log('PASS: Instamart v2 parser renders 9/9 cards (cards 7 + listing 2) + high-discount 8/8, 100%-off first + page-2 gate + self-test PASS + diagnostics 5/5');
} else {
  console.log('FAIL: expected cards 7, listing 2, self-test PASS, diagnostics 5/5, 0 bad items, 9 cards, high-discount 8 (100% first), OOS kept flagged, page-2 gate true/false');
  process.exit(1);
}
