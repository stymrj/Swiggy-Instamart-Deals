// Swiggy Instamart API client for the Telegram bot (Node 18+, no dependencies).
// Same API shape as the bookmarklet, re-implemented here (the reference
// implementation is unlicensed, so no code is copied — only endpoint paths,
// query/body fields and header names):
//   GET  /api/instamart/collection/items?collectionId&storeId&primaryStoreId
//        &secondaryStoreId&offset&serviceLine=INSTAMART
//   POST /api/instamart/category-listing/filter/v2?...&pageNo&offset
//        body {categoryName, filterName, filterId, taxonomyType,
//              items_offset, facets:[], sortAttribute:'discountPercentHighToLow'}
//   GET  /api/instamart/category-listing/v2?categoryName&taxonomyType&offset
//        &storeId&primaryStoreId&secondaryStoreId
// Headers: matcher (generated per request), x-build-version, x-device-id.
// Needs a real user session: SWIGGY_COOKIE from your own logged-in Swiggy
// tab, plus the dark-store ids (SWIGGY_STORE_ID etc.). Without them the
// calls return empty / 403. All fetches carry a 15s timeout so a dead
// endpoint fails fast instead of hanging the run.
const API = 'https://www.swiggy.com/api/instamart';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function matcher() {
  const r5 = () => Math.floor(10000 + Math.random() * 90000).toString();
  const raw = r5() + Date.now().toString() + r5();
  return raw.split('').map(d => (parseInt(d, 10) + 7).toString(36)).join('');
}
function headers() {
  const h = { accept: '*/*', 'accept-language': 'en-US,en;q=0.9', 'content-type': 'application/json', matcher: matcher(), 'x-build-version': process.env.SWIGGY_BUILD_VERSION || '2.363.0', 'x-device-id': process.env.SWIGGY_DEVICE_ID || require('crypto').randomUUID(), referer: 'https://www.swiggy.com/instamart', origin: 'https://www.swiggy.com', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' };
  if (process.env.SWIGGY_COOKIE) h.cookie = process.env.SWIGGY_COOKIE;
  return h;
}
async function apiRequest(url, method, body, attempt) {
  attempt = attempt || 0;
  try {
    const opts = { method: method || 'GET', headers: headers(), signal: AbortSignal.timeout(15000) };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    let json = null; try { json = await res.json(); } catch (e) { /* ignore */ }
    const limited = res.status === 429 || res.status === 403 || (json && (json.statusCode === 429 || json.statusCode === 403));
    if (limited && attempt < 2) { await sleep(5000 * Math.pow(2, attempt) + Math.floor(Math.random() * 2000)); return apiRequest(url, method, body, attempt + 1); }
    if (res.status >= 500 && attempt < 2) { await sleep(2000 * Math.pow(2, attempt)); return apiRequest(url, method, body, attempt + 1); }
    if (res.status === 200 && json && json.data) return json;
    if (limited) console.error('[api] rate-limited:', res.status, url.split('?')[0]);
    return null;
  } catch (e) { console.error('[api] request failed:', e.message); return null; }
}
function extractVariations(node, out) {
  if (!node || typeof node !== 'object') return;
  if (node.variations && Array.isArray(node.variations)) { out.push(...node.variations); return; }
  if (node.displayName && (node.price || node.offerPrice)) { out.push(node); return; }
  for (const v of Object.values(node)) extractVariations(v, out);
}
// Money in any shape the API sends: {units, nanos}, a plain number, or a
// formatted string ("₹1,999"). Unreadable values are 0, never NaN — same fix
// as the bookmarklet: NaN used to fail the sell check and drop the item.
const money = x => {
  if (x == null) return 0;
  if (typeof x === 'object') {
    if (x.units != null) return +x.units + (+x.nanos || 0) / 1e9;
    return 0;
  }
  if (typeof x === 'number') return isFinite(x) ? x : 0;
  const m = String(x).replace(/,/g, '').match(/\d+(\.\d+)?/);
  return m ? +m[0] : 0;
};
// Discount percent from the payload, in whatever shape it arrives: number 95,
// string "95" / "95%", or fraction 0.9. Null when absent/unreadable.
const discPct = v => {
  if (v == null) return null;
  let n;
  if (typeof v === 'number') n = v;
  else { const m = String(v).match(/\d+(\.\d+)?/); if (!m) return null; n = +m[0]; }
  if (!isFinite(n)) return null;
  if (n > 0 && n < 1) n *= 100; // fraction form, e.g. 0.9 = 90%
  return Math.round(n);
};
// Page 2 is worth fetching when page 1 looks full. The old gate also
// demanded the last item be >50% off — that assumed discount-sorted order,
// which only the filter POST provides; the collection / listing GET endpoints
// return unsorted order, so the deepest discounts on page 2 were never fetched.
function imShouldExpand(items) { return Array.isArray(items) && items.length >= 15; }
function parseItems(data, catLabel, subName) {
  if (!data || !data.data) return [];
  const variations = [];
  extractVariations(data.data, variations);
  const seen = new Map();
  for (const v of variations) {
    const priceObj = v.price;
    const isPriceObj = priceObj && typeof priceObj === 'object';
    const mrp = money(isPriceObj ? priceObj.mrp : undefined);
    let sell = money(isPriceObj ? priceObj.offerPrice : undefined);
    let hasSell = isPriceObj && priceObj.offerPrice != null;
    if (!hasSell && v.offerPrice != null) { sell = money(v.offerPrice); hasSell = true; }
    if (!hasSell && typeof priceObj === 'number') { sell = money(priceObj); hasSell = true; }
    const explicit = discPct(v.discountPercent != null ? v.discountPercent : v.discountPercentage != null ? v.discountPercentage : v.discount != null ? v.discount : v.offerPercentage);
    // No selling price: derive it from MRP + the payload's own discount.
    // A ₹0 offer price with an MRP is a genuine free item, not a missing price.
    if (!hasSell && mrp > 0 && explicit) sell = +(mrp * (1 - explicit / 100)).toFixed(2);
    if (!hasSell && sell <= 0) continue; // no selling price, nothing to derive one from
    if (!v.displayName) continue;
    const m = mrp < sell ? sell : mrp;
    let disc = m > sell ? Math.round((m - sell) / m * 100) : 0;
    if (!disc && explicit) disc = explicit;
    const imageId = (v.imageIds && v.imageIds[0]) || v.imageId || '';
    // Out-of-stock items are kept, flagged inStock:false (bot.js only posts
    // in-stock deals, so alerts are unaffected); dropping them here hid
    // clearance items from the price history entirely.
    const item = { id: String(v.skuId || v.spinId || v.id || v.displayName), title: String(v.displayName) + (v.quantityDescription ? ' · ' + v.quantityDescription : ''), brand: String(v.brandName || v.brand || 'Instamart'), price: sell, mrp: m, disc, save: +(m - sell).toFixed(2), img: imageId ? 'https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,w_450,h_450,c_fit/' + imageId : '', url: 'https://www.swiggy.com/instamart/search?custom_back=true&query=' + encodeURIComponent(v.displayName), inStock: !(v.inventory && v.inventory.inStock === false), cat: subName ? catLabel + ' › ' + subName : catLabel };
    const old = seen.get(item.id);
    if (!old || item.price < old.price) seen.set(item.id, item);
  }
  return [...seen.values()];
}
function endpoints(cat, sub, store, pageNo, offset) {
  const q = 'storeId=' + store.sid + '&primaryStoreId=' + store.pid + '&secondaryStoreId=' + store.secid;
  const isColl = !!(sub.isCollection || cat.campaignType === 'collection');
  if (isColl) return { method: 'GET', url: API + '/collection/items?collectionId=' + sub.id + '&isMonetised=true&' + q + '&offset=' + offset + '&serviceLine=INSTAMART', body: null };
  if (sub.id) return { method: 'POST', url: API + '/category-listing/filter/v2?' + q + '&pageNo=' + pageNo + '&offset=' + offset + '&page_name=category_listing_filter', body: { categoryName: cat.cName, filterName: sub.name, filterId: sub.id, taxonomyType: cat.tType || 'taxonomy 5', items_offset: String(offset === 0 ? 0 : 26), facets: [], sortAttribute: 'discountPercentHighToLow' } };
  return { method: 'GET', url: API + '/category-listing/v2?categoryName=' + encodeURIComponent(cat.cName) + '&taxonomyType=' + encodeURIComponent(cat.tType) + '&offset=' + offset + '&' + q, body: null };
}
// One sub-category: primary endpoint, listing fallback, smart page 2.
async function fetchSubcategory(cat, sub, store) {
  const ep = endpoints(cat, sub, store, 0, 0);
  let data = await apiRequest(ep.url, ep.method, ep.body);
  let items = data ? parseItems(data, cat.name, sub.name) : [];
  if (!items.length && !sub.isCollection) {
    const fb = endpoints({ cName: cat.cName, tType: cat.tType, name: cat.name }, { name: sub.name }, store, 0, 0);
    const data2 = await apiRequest(fb.url, fb.method, fb.body);
    if (data2) items = parseItems(data2, cat.name, sub.name);
  }
  if (imShouldExpand(items)) {
    await sleep(150);
    const ep2 = endpoints(cat, sub, store, 1, 1);
    const data2 = await apiRequest(ep2.url, ep2.method, ep2.body);
    if (data2) items = items.concat(parseItems(data2, cat.name, sub.name).filter(p => !items.some(q => q.id === p.id)));
  }
  return items;
}
module.exports = { fetchSubcategory, parseItems, apiRequest, imShouldExpand };
