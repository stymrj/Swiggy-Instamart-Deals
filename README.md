# PriceDrop Hunter for Swiggy Instamart

Collects Swiggy Instamart products as you browse, ranks them by real savings, and tracks price changes between visits. It runs in your own browser as a bookmarklet or userscript. Nothing is uploaded and there is no account.

**Live page:** https://stymrj.github.io/Swiggy-Instamart-Deals/

## Features

- Ranks by percent off and rupees saved together
- Labels products that are new or cheaper than your last scan
- Filters: search, category, brand, maximum price, minimum discount, stock, saved items
- Shopping list with quantities, total and total savings
- CSV export and copy-to-share text
- Grid and list views, light and dark themes, keyboard shortcuts
- Settings, saved items and price history stay in your browser

## Install

**Bookmarklet (desktop).** Run `node build.js`, open `index.html`, and drag the button to your bookmarks bar. Open swiggy.com and click the bookmark.

**Bookmarklet (mobile).** Copy the code from the page, create a bookmark, and paste the code as its address. Run it from the address bar on swiggy.com.

**Userscript.** Install `dist/instamart-deals.user.js` in Tampermonkey or Violentmonkey. A small Deals button appears on every swiggy.com page.

**Demo.** Use "Try the demo" on the install page to explore the interface with sample data.

## Keyboard shortcuts

`/` search, `S` scan or stop, `Esc` close.

## Telegram alerts

Hunter can send new deals, price drops and cheaper saved items to your Telegram.

1. In Telegram, open `@BotFather`, send `/newbot`, and copy the bot token.
2. Open your new bot and press **Start**.
3. Get your chat ID from `@userinfobot`, or open `https://api.telegram.org/bot<token>/getUpdates` and copy `chat.id`.
4. In Hunter's sidebar, open **Telegram alerts**, paste the token and chat ID, press **Send test message**, then switch alerts on.
5. Optional: set **Auto-scan** (for example every 15 minutes) and keep the tab open.

Each deal is sent once, and again only if its price drops further. Use the userscript for alerts: some shops block bookmarklets from calling Telegram, while the userscript sends through `GM_xmlhttpRequest`. The token is stored only in your browser.

## How it gets data

Instamart signs its own requests, so this tool does not make any. Instead it listens to the product lists the Instamart page already loads in your tab and reads them. Nothing is sent anywhere and no requests are altered.

## Limitations

- You only see what the page loads: open categories or use Auto-scroll to collect more.
- Response shapes are matched generically and have not been verified against every region.
- Hunter must be opened before browsing so it can listen; reopen it and browse again if you opened it late.

## Project layout

```
src/deals.js         the app (one file, no dependencies)
src/index.tpl.html   install page template
build.js             builds dist/ and index.html
favicon.svg
```

Run `node build.js` after any change.

---

Made with ♥ by [Satyam Raj](https://www.linkedin.com/in/satyamraj1)
