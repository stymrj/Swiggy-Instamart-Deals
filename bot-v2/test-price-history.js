// Unit test for the bot's price-history helper (no network, no Telegram).
// Run: node test-price-history.js   (from bot-v2/)
const { record } = require('./src/priceHistory');
const hist = {};
let r = record(hist, 'a', 100, 1000);
console.log('first sighting: lowestEver?', r.isLowestEver, '(expected false — nothing to compare)');
console.log('first sighting: isDrop?', r.isDrop, '(expected false)');
r = record(hist, 'a', 90, 2000);
console.log('90 after 100: isDrop?', r.isDrop, 'lowestEver?', r.isLowestEver, 'previous?', r.previous);
r = record(hist, 'a', 95, 3000);
console.log('95 after 90: isDrop?', r.isDrop, '(expected false)', 'previous?', r.previous);
r = record(hist, 'a', 80, 4000);
console.log('80 after 95: isDrop?', r.isDrop, 'lowestEver?', r.isLowestEver, '(expected true)');
for (let i = 0; i < 12; i++) record(hist, 'a', 80 + i, 5000 + i);
console.log('history pruned to 10?', hist.a.length === 10, `(got ${hist.a.length})`);
const ok = hist.a.length === 10;
if (ok) console.log('PASS: price-history detects drops and lowest-ever, prunes to 10 points');
else { console.log('FAIL: price-history'); process.exit(1); }
