# Turfline — status & next steps

_Last updated: 2026-08-29_

## Links

- **Live app:** https://crm.yateartificialgrass.com/ (also https://aaronbooker98.github.io/turfline/)
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

### Phase 1 — custom web address  (DONE)
Live at https://crm.yateartificialgrass.com/ with HTTPS.
- [x] DNS CNAME `crm` -> `aaronbooker98.github.io` added in Squarespace
      (domain is registered "through Google", now managed at account.squarespace.com;
      website + Google email untouched)
- [x] `CNAME` file in the repo
- [x] GitHub issued the HTTPS certificate
- [x] "Enforce HTTPS" ticked — http:// now redirects to https://

### Phase 2 — shared login + database
Right now each device stores its own data. To have office + fitters on the same
live data: **Supabase** (hosted Postgres + user accounts + live sync). Free tier
now, ~£20/mo only once it grows. App stays on the current GitHub domain.
- Open questions: existing data to import (Zoho? spreadsheet? how many records?);
  how many staff logins; office-vs-fitter access split.

## Notes

- Hostinger is NOT part of the plan. Checked the account (2026-08-29): no domains,
  no hosting plan, no subscriptions — it's empty. Using it would mean buying
  hosting for a worse result than the free GitHub + Supabase setup.
- The Hostinger Claude Code plugin is connected but unused. Harmless, leave it.
- Domain is at Squarespace (registered "through Google"). Website + Google email
  live there, untouched.
