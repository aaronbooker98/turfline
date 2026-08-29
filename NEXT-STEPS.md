# Turfline — status & next steps

_Last updated: 2026-08-29_

## Links

- **Live app:** https://aaronbooker98.github.io/turfline/
- **Code (GitHub):** https://github.com/aaronbooker98/turfline
- **Project folder:** `~/Desktop/turfline`
- **Local preview (only while a dev server is running):** http://localhost:5173

## How to publish changes

Open **GitHub Desktop** → write a short summary → **Commit to main** → **Push origin**.
The live site rebuilds itself about a minute later.

## What's been built

- **Today** — chase list, cold-quote flag, installs this week
- **Leads** — sortable/filterable table of every enquiry
- **Pipeline** — board by stage; drag a card between columns to move it along
- **Schedule** — crews across a week, clash detection
- **Analytics** — enquiry→won funnel, win rate, avg job value & days to close,
  revenue by month, lead-source performance
- **Job sheets** — phone view for fitters
- **Settings** — rates, crews, export/import
- Branding: Yate Artificial Grass logo + palette taken from it
- ~20 example records load automatically; Settings → wipe to clear
- 19 unit tests passing (`npm test`)

## Still to do

### Phase 1 — custom web address
`crm.yateartificialgrass.com` pointing at the current free GitHub site.
- Add a `CNAME` file to the repo
- Add one DNS record in the Hostinger control panel (domain is managed at Hostinger,
  account: aaron@yateartificialgrass.com)
- Turn on HTTPS in GitHub Pages settings
- Existing website is untouched

### Phase 2 — shared login + database
Right now each device stores its own data. To have office + fitters on the same
live data:
- **Recommended:** Supabase (hosted Postgres + user accounts + live sync).
  Free tier now, ~£20/mo once it grows. App stays on the same domain.
- **Alternative:** build it all on Hostinger's MySQL — one bill, but more build
  time and no built-in login/sync.
- Open questions: existing data to import (Zoho? spreadsheet? how many records?);
  how many staff logins; office-vs-fitter access split.

## Notes

- The Hostinger Claude Code plugin is installed but not active — needs a VS Code
  window reload and a Hostinger API token to connect. Not needed unless we decide
  to drive Hostinger changes through it.
- Never share the Hostinger password. The plugin uses an API token instead.
