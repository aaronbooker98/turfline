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
live data: **Supabase** (hosted Postgres + shared database + live sync). Free tier
now, ~£20/mo only once it grows. App stays on the current GitHub domain.

**Logins (decided 2026-08-29): two SHARED accounts, not per-person.**
- **Office** — one email+password shared by office staff. Full access to
  everything (Today, Leads, Pipeline, Schedule, Analytics, Job sheets, Settings).
- **Fitters** — one email+password shared by all fitters. Sees ONLY: their
  assigned Job sheets, and Schedule (view only). Hidden: Leads, Pipeline,
  Analytics, Settings, and all quote £ amounts. Can mark a job complete.

**Data:** no back-catalogue to import — start fresh, add leads from now on.

**Website leads (follow-up after Phase 2, not a blocker):**
- yateartificialgrass.com = WordPress + Divi, built by YZ Designs. Contact form is
  **WPForms**. Submissions currently only email aaron@yateartificialgrass.com.
- Plan: build a Supabase function endpoint; YZ Designs adds a WPForms webhook
  pointing at it so website enquiries auto-create leads (source = "Website form").
- Needs WPForms Pro/Elite or its Zapier addon for webhooks; if only the basic
  licence, use a small `wpforms_process_complete` code snippet instead.
- Until then: office copies enquiry emails into the CRM manually (New enquiry).

**Build outline:**
1. Create Supabase project; tables for leads, crews, rates/business settings
2. Add Supabase JS client; move state.js load/save from localStorage to Supabase
3. Realtime subscription so edits sync between devices
4. Login screen; hide/lock UI by role (office vs fitters)
5. Row-level security so the fitters login can't pull pipeline/money data
6. Seed / import real data
7. Keep export-backup working as a safety net

## Notes

- Hostinger is NOT part of the plan. Checked the account (2026-08-29): no domains,
  no hosting plan, no subscriptions — it's empty. Using it would mean buying
  hosting for a worse result than the free GitHub + Supabase setup.
- The Hostinger Claude Code plugin is connected but unused. Harmless, leave it.
- Domain is at Squarespace (registered "through Google"). Website + Google email
  live there, untouched.
