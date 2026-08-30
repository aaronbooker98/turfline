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
- **Schedule** — Week grid (default) or Month calendar, toggle at the top, clash detection
- **Pricing** — per-m² cost stack (grass + groundworks + labour/vans/sundries),
  each groundworks line switchable per job, then a Margin % → price, then VAT.
  Edit every rate in Settings → Pricing. Customer quote shows one supply-&-install line.
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

### Phase 2 — shared login + database  (DONE, live 2026-08-29)
Supabase project `jhkhchhszwmtlhnhmowr`. Live at crm.yateartificialgrass.com.
- Two shared logins: office@ (full) / fitters@ (job sheets + schedule only).
  Fitters are blocked from leads/pricing at the database, verified.
- Data in hosted Postgres; office devices live-sync; fitters refresh on focus.
- `supabase/setup.sql` is the schema of record. `src/db.js` is the data layer.
- Login creds live in Supabase dashboard -> Authentication -> Users.

Loose ends:
- [ ] **Run the pricing reset SQL** (Supabase → SQL Editor) so the live rates match
      the new per-m² model — the block is in the 2026-08-30 pricing change. Until then
      the live app still carries the old Meadow/Fairway/Premier rates.
- [ ] Change the fitters password from "YAG123" to something stronger
      (Supabase -> Auth -> Users -> the fitters row -> reset password).
- [ ] Settings still has "Load example data" / "Delete every record" — office only
      and confirm-gated, but consider removing before wider use.
- [ ] delete local branch `phase-2-supabase` (merged).

**Logins (decided 2026-08-29): two SHARED accounts, not per-person.**
- **Office** — one email+password shared by office staff. Full access to
  everything (Today, Leads, Pipeline, Schedule, Analytics, Job sheets, Settings).
- **Fitters** — one email+password shared by all fitters. Sees ONLY: their
  assigned Job sheets, and Schedule (view only). Hidden: Leads, Pipeline,
  Analytics, Settings, and all quote £ amounts. Can mark a job complete.

**Data:** no back-catalogue to import — start fresh, add leads from now on.

### Phase 3 — auto-capture incoming leads (follow-up, not a blocker)

Two sources to bring in. Build ONE receiving endpoint on Supabase
(RPC `ingest_lead(payload jsonb)`, security definer, shared-secret check, inserts
into `leads`), then point both at it. Each incoming lead sets `channel`
("phone" for WhatConverts, "web" for WPForms) and `source` (the marketing
attribution). The Leads tab already filters on `channel` (Phone call / Web form /
Manual) and `source`.

Catcher: **Edge Function `ingest`** (supabase/functions/ingest/index.ts), deployed,
Verify-JWT off, secret INGEST_TOKEN set. Tested OK (phone/web mapping, dedup on
`data._ext`, spam skip). Webhook URL:
`https://jhkhchhszwmtlhnhmowr.supabase.co/functions/v1/ingest?token=<INGEST_TOKEN>`

1. **WhatConverts** — CALLS ONLY (their web forms are not tracked by WhatConverts).
   Webhook is URL-only, no headers. Point it at the URL above, trigger "new lead",
   lead types = Phone Call (+ chat/text if used). [in progress]
2. **WPForms** contact form on yateartificialgrass.com (WordPress + Divi, by
   YZ Designs) — the ONLY path for web enquiries. Same catcher URL; YZ Designs
   adds the webhook on the WP side (~10 min). Check WPForms licence supports
   webhooks (Pro/Elite or Zapier addon) else a `wpforms_process_complete` snippet.
   The `ingest` function's form-field mapping may need tuning to WPForms' payload.

Until WPForms is wired: office adds web enquiry emails to the CRM by hand.

**Phone numbers:**
- 01454 537330 — AirLandline landline, on the Google listing. Track by adding a
  WhatConverts number and forwarding AirLandline through it.
- 07861 676629 — O2 mobile, signwritten on the vans (must keep). Track via O2 call
  divert to a WhatConverts number, or port it. Decision pending.
- Whatever WhatConverts number currently feeds the webhook = the Google Ads number.

**Brief for YZ Designs (they manage WhatConverts + the website):**
1. Confirm the WhatConverts webhook is live, pointed at the ingest URL, "new lead",
   Phone Call + Web Form.
2. Add a WhatConverts tracking number for 01454 537330; set AirLandline to forward
   through it. Label "Landline - organic".
3. Advise best way to track 07861 676629 (keep the number) - divert vs port.
4. Add a webhook on the WPForms contact form to the same ingest URL. Confirm the
   WPForms licence supports webhooks (Pro/Elite or Zapier addon) else use a
   `wpforms_process_complete` snippet. May need mapping tweaks for WPForms' payload.

Ingest webhook URL:
https://jhkhchhszwmtlhnhmowr.supabase.co/functions/v1/ingest?token=<INGEST_TOKEN in Supabase Edge Function secrets>

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
