# Changelog

## v2.0.0 — 2026-11-08

- Fetch layer rewritten: active API scan replaces capture-only mode — collection
  items (GET), category-listing filter (POST, discount high to low), category
  listing (GET); `matcher` / `x-build-version` / `x-device-id` headers; store
  ids auto-detected from the tab (URL, performance entries, page state, storage).
- 16 categories (fresh, staples, oils, NOICE collections and more) scanned in
  parallel (3 workers) with de-dupe across pages; smart page 2 when page 1
  ends above 50% off with 15+ items.
- Fallbacks: filter POST → listing GET → passive capture of the page's own loads.
- Retry with exponential backoff + jitter on 429/403/5xx (max 3 attempts).
- New Telegram bot `bot-v2/` (Node, no dependencies): 8 campaigns, dedupe +
  price-history DB with "Lowest ever" / "Price drop" tags; scheduled one-shot
  runs via cron. Needs the user's own Swiggy cookie + store ids.
- Blank-results fix: a page of already-seen items no longer ends a scan early;
  one tolerant parser for cards, listings and page state (incl. `{units, nanos}`
  prices).
- Empty-state diagnostics (no store / rate-limited / session expired /
  category-empty) and an in-browser self-test button.
- JSON export added alongside CSV.
- Regression test `test-results-tab.js` (cards 6 + listing 2 = 8 cards) and bot
  price-history test; `node build.js` rebuilds `dist/` and `index.html`.
