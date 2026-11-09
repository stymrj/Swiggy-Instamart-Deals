// Swiggy Instamart deals Telegram bot (Node 18+, no dependencies).
// Runs the configured campaigns (see config.json) against the Instamart
// category/collection APIs, dedupes against data/posted.json, keeps a price
// history in data/prices.json, and posts new deals >= minDiscount to
// Telegram — tagged "Lowest ever" / "Price drop" when the history says so.
// Run once:  node src/bot.js        Run on a schedule: cron.
// Needs .env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SWIGGY_COOKIE (your own
// logged-in Swiggy session cookie), SWIGGY_STORE_ID / SWIGGY_PRIMARY_STORE_ID
// / SWIGGY_SECONDARY_STORE_ID (from your swiggy.com/instamart tab).
// Without a session cookie + store ids the APIs return nothing and the bot
// posts nothing. The browser bookmarklet is the reliable path; this bot is
// a convenience, and Swiggy may rate-limit server IPs (429) at any time.
// A missing cookie or missing store ids fails the run loudly (see main())
// instead of silently posting nothing.
// Dry run: node src/bot.js --dry-run, or DRY_RUN=true — prints the messages
// instead of sending them and saves no state (no dedupe/price-history writes).
const fs = require('fs'), path = require('path');
const { fetchSubcategory } = require('./instamartApi');
const { record } = require('./priceHistory');
const config = require('../config.json');
const DRY = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';
const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function loadJson(file) { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', file), 'utf8')); } catch (e) { return {}; } }
function saveJson(file, obj) { fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'data', file), JSON.stringify(obj, null, 2)); }
async function tgSend(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (DRY || !token || !chat) { console.log('[dry-run] message was:\n' + text.replace(/<[^>]+>/g, '')); return false; }
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }) });
  if (!r.ok) console.error('[telegram] HTTP', r.status, await r.text().catch(() => ''));
  return r.ok;
}
async function main() {
  if (!process.env.SWIGGY_COOKIE) { console.error('[bot] no session cookie — set SWIGGY_COOKIE (your own logged-in Swiggy session cookie); without it the APIs return empty / 403 and nothing is posted'); process.exit(1); }
  const store = {
    sid: process.env.SWIGGY_STORE_ID || (config.store && config.store.sid) || '',
    pid: process.env.SWIGGY_PRIMARY_STORE_ID || (config.store && config.store.pid) || '',
    secid: process.env.SWIGGY_SECONDARY_STORE_ID || (config.store && config.store.secid) || ''
  };
  if (!store.pid && !store.sid) { console.error('[bot] no store ids — set SWIGGY_STORE_ID / SWIGGY_PRIMARY_STORE_ID in .env (copy them from your swiggy.com/instamart tab)'); process.exit(1); }
  // MIN_DISCOUNT env is a floor over the per-campaign minimums in config.json
  // (a campaign's own floor still applies when it is higher).
  const envMin = +(process.env.MIN_DISCOUNT || 0);
  const posted = loadJson('posted.json'), prices = loadJson('prices.json');
  const found = [];
  for (const [key, camp] of Object.entries(config.campaigns || {})) {
    if (camp.enabled === false) continue;
    for (const sub of camp.subcategories || []) {
      const cat = { name: camp.name, cName: sub.category || camp.name, tType: sub.taxonomyType || 'taxonomy 5', campaignType: camp.type === 'collection' ? 'collection' : undefined };
      console.log(`[bot] ${camp.name} > ${sub.name}`);
      let items = [];
      try { items = await fetchSubcategory(cat, sub, store); } catch (e) { console.error(`[bot] ${sub.name} failed:`, e.message); }
      for (const p of items) if (p.disc >= Math.max(envMin, camp.minDiscount || config.minDiscount || 70) && p.inStock && !posted[p.id]) found.push(p);
      await sleep(600 + Math.random() * 800);
    }
    console.log(`[bot] campaign ${key} done`);
  }
  found.sort((a, b) => b.disc - a.disc || b.save - a.save);
  for (const item of found) { const r = record(prices, item.id, item.price); item.prevPrice = r.previous; item.isDrop = r.isDrop; item.lowestEver = r.isLowestEver; }
  if (DRY) console.log('[dry-run] price history not saved'); else saveJson('prices.json', prices);
  console.log(`[bot] ${found.length} new deals`);
  const top = found.slice(0, 10);
  for (const p of top) {
    const tags = [p.lowestEver ? 'Lowest ever' : '', p.isDrop && p.prevPrice != null ? `Price drop ₹${p.prevPrice} → ₹${p.price}` : ''].filter(Boolean).join(' · ');
    const msg = `<b>${p.disc}% off</b> · ${esc(p.title)}${tags ? `\n${esc(tags)}` : ''}\n₹${p.price} <s>₹${p.mrp}</s> · save ₹${p.save}\n${esc(p.cat)}${p.url ? `\n<a href="${esc(p.url)}">Open on Instamart</a>` : ''}`;
    if (await tgSend(msg)) posted[p.id] = p.price;
    await sleep(400);
  }
  // (Skipped on dry runs: a preview must not consume dedupe state.)
  if (!DRY) for (const p of found.slice(10)) posted[p.id] = p.price;
  if (DRY) console.log('[dry-run] dedupe state not saved'); else saveJson('posted.json', posted);
  console.log('[bot] done');
}
main().catch(e => { console.error(e); process.exit(1); });
