# Instamart deals bot v2

Telegram bot that scans Swiggy Instamart campaigns (fresh, grocery, treats,
munchies, beverages, personal, lifestyle, NOICE collections) and posts new
deals to Telegram.

## How it works

- `src/instamartApi.js` calls the Instamart APIs from the bookmarklet's
  shape: collection items (GET), category-listing filter (POST, sorted by
  discount high to low), and category listing (GET) as a fallback, with
  `matcher` / `x-build-version` / `x-device-id` headers, exponential
  backoff on 429/403/5xx, and a smart page 2 when page 1 looks full (15+
  items).
- `src/bot.js` dedupes against `data/posted.json` (a deal is posted once)
  and keeps a price history in `data/prices.json` (`src/priceHistory.js`),
  so messages are tagged **Lowest ever** or **Price drop ₹X → ₹Y** when the
  history supports it. At most the top 10 new deals per run.

## Setup

```bash
cp .env.example .env   # fill in your own token, chat ID, cookie and store ids
node src/bot.js
```

No dependencies (Node 18+). One-shot run — put it on cron for scheduled runs.

| Variable | Where it comes from |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | @BotFather → `/newbot` |
| `TELEGRAM_CHAT_ID` | @userinfobot, after pressing Start in your bot |
| `SWIGGY_COOKIE` | Your own logged-in Swiggy tab (DevTools → Application → Cookies) |
| `SWIGGY_STORE_ID` / `SWIGGY_PRIMARY_STORE_ID` / `SWIGGY_SECONDARY_STORE_ID` | Your dark-store ids, from the swiggy.com/instamart page (URL / page state). Primary id is required. |
| `MIN_DISCOUNT` | Global floor (default 70; per-campaign floors in `config.json`) |

## Limits (read before running)

- The APIs need **your own session cookie and store ids**. Without them the
  bot posts nothing. Cookies expire — refresh `.env` when it goes quiet.
- Swiggy rate-limits aggressively (429/403, WAF). The bot backs off and
  retries, but a server IP can still be blocked — the browser bookmarklet,
  running inside your own Swiggy tab, is the reliable path.
- Never share your `.env` or cookie — it is your Swiggy session.
