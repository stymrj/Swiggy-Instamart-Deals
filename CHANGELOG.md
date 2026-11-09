# Changelog

## v2.0.0 — 2026-11-08
- Fixed (2026-11-09): scheduled Telegram bot is now wired up — new
  `.github/workflows/telegram-bot.yml` runs `bot-v2/` every 30 minutes
  (08:31–00:01 IST) once the `BOT_ENABLED` variable is `true`; dedupe
  (`bot-v2/data/posted.json`) + price history (`bot-v2/data/prices.json`)
  persist through the Actions cache. Dry-run via workflow_dispatch is now
  honoured by the bot: it prints instead of sending and saves no state
  (previously no `DRY_RUN` handling existed at all). A missing session
  cookie or missing store ids now fails the run loudly instead of silently
  posting nothing.
- Fixed (2026-11-09): `MIN_DISCOUNT` in `.env.example` is now honoured —
  it was documented in the bot README but the bot never read it; it now acts
  as a floor over the per-campaign minimums in `bot-v2/config.json`.
- Fixed (2026-11-09): install page no longer calls the drag button
  “PriceDrop Hunter” or tells phones to name the bookmark “PriceDrop” —
  both now read “Swiggy Instamart Deals”, matching the install button and
  the README.
- Fixed (2026-11-09): retry claim corrected — backoff sleeps 2s then 4s
  (+ jitter), not 2s/4s/8s; max 3 attempts. Regression-test counts in the
  README corrected to 9/9 cards (7 cards + 2 listing).
- Fixed (2026-11-09): install button now reads “Swiggy Instamart Deals” instead of the generic “PriceDrop Hunter”, so the dragged bookmark is named after this store instead of colliding with every other tool.
- Fixed (2026-11-09): highest-discount items no longer vanish before any filter sees them — string prices ("₹1,999"), missing MRP with only a discount field, discounts as 0.9, free (₹0) items, flat-number prices, max-only listings, and out-of-stock clearance items (now kept, flagged inStock:false, instead of dropped at parse) now all parse (regression fixture `fixtures/sample-high-discount.json`, 8/8, 100%-off item sorts first); page 2 is no longer gated on the last item being >50% off — a full first page now earns page 2, since the collection/listing GET endpoints return unsorted order. Same fix mirrored in `bot-v2/`.

- Fetch layer rewritten: active API scan replaces capture-only mode — collection
  items (GET), category-listing filter (POST, discount high to low), category
  listing (GET); `matcher` / `x-build-version` / `x-device-id` headers; store
  ids auto-detected from the tab (URL, performance entries, page state, storage).
- 16 categories (fresh, staples, oils, NOICE collections and more) scanned in
  parallel (3 workers) with de-dupe across pages; smart page 2 when page 1
  is full (15+ items).
- Fallbacks: filter POST → listing GET → passive capture of the page's own loads.
- Retry with exponential backoff + jitter on 429/403/5xx (max 3 attempts).
- New Telegram bot `bot-v2/` (Node, no dependencies): 8 campaigns, dedupe +
  price-history JSON files with "Lowest ever" / "Price drop" tags; scheduled
  one-shot runs via the GitHub Actions workflow
  (`.github/workflows/telegram-bot.yml`, every 30 minutes). Needs the user's
  own Swiggy cookie + store ids.
- Blank-results fix: a page of already-seen items no longer ends a scan early;
  one tolerant parser for cards, listings and page state (incl. `{units, nanos}`
  prices).
- Empty-state diagnostics (no store / rate-limited / session expired /
  category-empty) and an in-browser self-test button.
- JSON export added alongside CSV.
- Regression test `test-results-tab.js` (cards 6 + listing 2 = 8 cards) and bot
  price-history test; `node build.js` rebuilds `dist/` and `index.html`.
