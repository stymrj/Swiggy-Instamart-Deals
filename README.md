# PriceDrop Hunter for Swiggy Instamart — v2.0.0

Scan Swiggy Instamart categories for the biggest discounts, in your own
browser as a bookmarklet or userscript. Nothing is uploaded and there is
no account.

**Live page:** https://stymrj.github.io/Swiggy-Instamart-Deals/

## What it does

- Asks which categories to scan, then shows the biggest discounts first —
  top deals overall plus the best of each category in a swipeable row
- 16 categories, from Fresh Vegetables to the NOICE Store collections
- Labels products that are new, cheaper than last time, or at their lowest
  price ever, with a price-history sparkline on every product seen before
- Saved items strip showing how much each one dropped since you saved it
- Unit price (per kg, litre or piece) with a value sort
- One-tap presets: under ₹99, 50% off, save ₹100+, price drops, lowest ever,
  best value
- Filters: search, category, brand, maximum price, minimum discount, stock,
  saved items · Shopping list with quantities, total and total savings
- CSV and JSON export · Grid and list views, light and dark themes,
  keyboard shortcuts · Settings, saved items and price history stay in
  your browser

## Why v2 is stronger

- **It actually scans now.** v1 only read pages you happened to open.
  v2 calls Instamart's own category APIs from your logged-in tab
  (collection items, category-listing filter sorted by discount high to
  low, category listing) across 16 categories, in parallel (3 workers),
  with de-dupe across pages.
- **Fallbacks at every step.** Filter POST empty → plain category-listing
  GET for the same category → passive capture of the page's own loads
  (kept from v1). A page of already-seen items no longer ends a scan
  early (that was the blank-results bug).
- **Retry with backoff.** 429/403/5xx responses retry exponentially
  (2s, 4s, 8s + jitter, max 3 attempts) instead of failing silently.
- **It tells you why 0 results.** The empty screen diagnoses no store
  detected / rate-limited / session expired / empty category, and a **Run
  self-test** button checks the parsers on sample data in the tab.
- **Smart page 2.** When page 1 ends above 50% off with 15+ items, page 2
  is fetched automatically.
- **Bot with a memory.** `bot-v2/` runs 8 campaigns (fresh, grocery,
  treats, munchies, beverages, personal, lifestyle, NOICE), dedupes, and
  keeps a price history so alerts say "Lowest ever" / "Price drop ₹X →
  ₹Y" (see `bot-v2/README.md`).
- Hunter-only strengths the baseline never had: price history + lowest-ever,
  saved-item tracking with sparklines, unit-price sort, CSV/JSON export.

## Install

![Install walkthrough](https://stymrj.github.io/PriceDrop-Hunter/media/install-demo.gif)

[Watch the walkthrough video (MP4)](https://stymrj.github.io/PriceDrop-Hunter/media/install-demo.mp4)

**Bookmarklet (desktop).** Run `node build.js`, open `index.html`, and drag
the button to your bookmarks bar. Open swiggy.com and click the bookmark.

**Bookmarklet (mobile).** On the install page, tap **Copy mobile loader**.
It is a bookmark of about 380 characters that loads the latest version from
GitHub Pages. Create a bookmark, paste it as the address, and run it from
the address bar on swiggy.com. The full bookmarklet (about 64 KB, no network
needed) is in `dist/bookmarklet.txt`.

**Userscript.** Install `dist/instamart-deals.user.js` in Tampermonkey or
Violentmonkey. A small Deals button appears on every swiggy.com page.

## Use

1. Open swiggy.com/instamart and set your delivery location (Hunter reads
   your dark-store id from that page — no manual paste needed).
2. Open Hunter, press **Choose & scan**, pick categories, press Scan.
3. Heart a deal to save it; **Add to list** builds a shopping list.
4. **Auto-scroll this page instead** still works as a capture fallback:
   open a category, auto-scroll to load more, and Hunter collects the
   products the page loads.

Keyboard shortcuts: `/` search, `S` scan or stop, `Esc` close.

## Telegram alerts

Hunter can send new deals, price drops and cheaper saved items to your
Telegram (in-browser alerts, set up in Hunter's top bar):

1. In Telegram, open `@BotFather`, send `/newbot`, and copy the bot token.
2. Open your new bot and press **Start**.
3. Get your chat ID from `@userinfobot`.
4. On the store, open Hunter, press **Telegram** in the top bar, paste the
   token and chat ID, press **Send test**, then switch alerts on.

Each deal is sent once, and again only if its price drops further. Use the
userscript for alerts: some shops block bookmarklets from calling Telegram,
while the userscript sends through `GM_xmlhttpRequest`. The token is stored
only in your browser.

## Bot setup (scheduled Telegram alerts)

`bot-v2/` is a separate Node bot (no dependencies, Node 18+). It needs your
own Swiggy session cookie and dark-store ids — see `bot-v2/README.md` and
`bot-v2/.env.example`. Without them the APIs return nothing and the bot
posts nothing. Run it on cron for scheduled runs.

## Troubleshooting

- **"No Instamart store detected".** Open swiggy.com/instamart with your
  delivery location set, then scan again.
- **"Rate-limited".** Wait a minute or two, then scan fewer categories.
  Swiggy rate-limits aggressively.
- **"Session expired".** Reload swiggy.com and log in again if asked.
- **"No deals in these categories".** Try more categories or lower the
  minimum discount in the menu.
- **Still stuck?** Press **Run self-test** in the sidebar: it checks the
  parsers on sample data. If it passes, the problem is the live session,
  store or location, not the code.
- Swiggy can change its APIs at any time; the listing fallback and the
  loose variation parser are there to survive small changes.

## Testing

```bash
node test-results-tab.js            # parser regression: 8 sample products must render as 8 cards
node bot-v2/test-price-history.js   # bot price-history: drops + lowest-ever
node build.js                       # rebuilds dist/ and index.html
```

The regression test loads the real parsers from `src/deals.js` and feeds
them an Instamart cards payload (`fixtures/sample-api.json`, 6 of 8
variations) and a category-listing payload (`fixtures/sample-listing.json`,
2 items), plus the self-test and diagnostics checks. Live Swiggy APIs are
**not** verified by these tests — they need a manual browser test on
swiggy.com/instamart.

## Project layout

```
src/deals.js         the app (one file, no dependencies)
src/index.tpl.html   install page template
build.js             builds dist/ and index.html
bot-v2/              Telegram bot (Instamart API client, campaigns, price history)
test-results-tab.js  parser regression test
fixtures/            sample cards + listing payloads
```

Run `node build.js` after any change.

## License

MIT — see `LICENSE`.

---

Made with ♥ by [Satyam Raj](https://www.linkedin.com/in/satyamraj1)
