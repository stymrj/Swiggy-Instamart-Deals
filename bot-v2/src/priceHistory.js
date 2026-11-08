// Price-history store for the Telegram bot: per product id, up to 10
// [timestamp, price] points, kept in data/prices.json. Pure functions, so
// they can be unit-tested offline (see test-price-history.js). The bot uses
// this to tag messages "Price drop" (cheaper than last seen) and "Lowest
// ever" (cheaper than every previous sighting) instead of only posting the
// latest deals.
function record(hist, id, price, now) {
  now = now || Date.now();
  const pts = hist[id] || (hist[id] = []);
  const prev = pts.length ? pts[pts.length - 1][1] : null;
  const lowest = pts.length ? Math.min.apply(null, pts.map(x => x[1])) : null;
  const out = { previous: prev, isDrop: prev != null && price < prev, isLowestEver: pts.length > 0 && (lowest == null || price < lowest) };
  if (prev !== price || !pts.length || now - pts[pts.length - 1][0] > 864e5) { pts.push([now, price]); if (pts.length > 10) pts.splice(0, pts.length - 10); }
  return out;
}
module.exports = { record };
