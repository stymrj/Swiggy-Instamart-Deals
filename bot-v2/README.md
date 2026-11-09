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
node src/bot.js --dry-run   # prints the messages, sends nothing, saves no state
node src/bot.js
```

No dependencies (Node 18+). One-shot run, not a daemon.

## Scheduled runs (GitHub Actions)

`.github/workflows/telegram-bot.yml` runs the bot every 30 minutes
(08:31–00:01 IST) once the repository **variable** `BOT_ENABLED` is `true`.
Set these in Settings → Secrets and variables → Actions (see the workflow
file header and the repo README for the full steps):

- Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SWIGGY_COOKIE`
- Variables: `SWIGGY_STORE_ID` / `SWIGGY_PRIMARY_STORE_ID` (at least the
  primary id is **required**), `SWIGGY_SECONDARY_STORE_ID` (optional),
  `SWIGGY_DEVICE_ID` (optional), `SWIGGY_BUILD_VERSION` (optional, default
  2.363.0), `MIN_DISCOUNT` (optional, default 70)

Dedupe (`data/posted.json`) and price history (`data/prices.json`) persist
between runs through the Actions cache. To preview a run: Actions →
**Telegram deal alerts** → Run workflow → tick **Print the messages
instead of sending them** (dry-run).

| Variable | Where it comes from |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | @BotFather → `/newbot` |
| `TELEGRAM_CHAT_ID` | @userinfobot, after pressing Start in your bot |
| `SWIGGY_COOKIE` | Your own logged-in Swiggy tab (DevTools → Application → Cookies). **Required** — without it the bot exits non-zero. |
| `SWIGGY_STORE_ID` / `SWIGGY_PRIMARY_STORE_ID` / `SWIGGY_SECONDARY_STORE_ID` | Your dark-store ids, from the swiggy.com/instamart page (URL / page state). Primary id is required. |
| `SWIGGY_DEVICE_ID` | Optional — generated per run when unset |
| `SWIGGY_BUILD_VERSION` | Optional — the `x-build-version` header (default 2.363.0) |
| `MIN_DISCOUNT` | Floor over the per-campaign minimums in `config.json` (default 70) |
| `DRY_RUN` | `true` prints the messages instead of sending them, and saves no state |

## Limits (read before running)

- The APIs need **your own session cookie and store ids**. Without them the
  bot posts nothing — a missing cookie or missing store ids now fails the
  run loudly instead of silently posting nothing. Cookies expire — refresh
  the secret when it goes quiet.
- Swiggy rate-limits aggressively (429/403, WAF). The bot backs off and
  retries, but a server IP can still be blocked — the browser bookmarklet,
  running inside your own Swiggy tab, is the reliable path.
- Never share your `.env` or cookie — it is your Swiggy session.
