# Turfline

CRM and job management for an artificial grass installation business. Built around the
two things that actually cost money: quotes that go unchased, and installs that clash.

No framework, no build step, no dependencies. Plain ES modules, so what you read is
what runs in the browser.

## Running it

```bash
npm start          # http://localhost:5173
npm test           # unit tests for the pricing, scheduling and analytics rules
```

`npm start` serves the folder over http, which ES modules need — opening `index.html`
straight off disk will not work. A fresh load comes pre-filled with example records
so every screen has something to show; clear them from Settings → Your data.

## What's where

```
index.html            page shell; loads fonts and src/app.js
dev-server.js         20-line static server, no dependencies
src/
  app.js              routing, event delegation, persistence
  model.js            the business rules — quoting, stages, follow-ups, clashes
  analytics.js        aggregations — funnel, win rate, revenue by month, source stats
  state.js            state shape, defaults, localStorage, sample data
  util.js             dates, money, escaping
  icons.js            inline SVG
  styles.css          design tokens (palette taken from the Yate logo) and components
  assets/             the Yate Artificial Grass logo, shown in the sidebar
  views/              one module per screen
test/
  model.test.js       covers model.js — run before you change pricing
  analytics.test.js   covers analytics.js — the funnel and money maths
```

`model.js` and `analytics.js` have no DOM in them on purpose: everything that decides
money or dates is testable without a browser. If you change how a job is priced or how
a number on the Analytics screen is worked out, change it there and add a test.

## Screens

- **Today** — overdue and due-today follow-ups, plus installs in the next week.
  Quotes with no movement for 14 days are flagged cold.
- **Leads** — every enquiry in one table: search, filter by stage / source / how it
  came in (phone / web / manual), sort any column. Click a row for the full record.
- **Pipeline** — board by stage; drag a card between columns to move it along.
- **Schedule** — crews across a week. Two jobs on one crew on one day turn red.
- **Analytics** — enquiry → won funnel, win rate, average job value and days to close,
  revenue by month, lead-source performance, why deals are lost, money still owed.
- **Job sheets** — phone view for fitters: address, spec, materials to load, mark complete.
- **Settings** — rates, business details and quote terms, crews, export/import.

The record drawer also has: a printable **quote** (own window → Print / Save PDF),
**deposit / balance** tracking on won jobs, a **lost-reason** picker, and a
**possible-duplicate** nudge when the phone or postcode matches another record.

## Logins

Two shared logins via Supabase Auth. `office@…` sees everything; anything else is a
fitter — job sheets and a read-only schedule only, no pricing or pipeline, enforced
by row-level security. See `SUPABASE-SETUP.md`.

## How pricing works

Everything comes off the surveyed area:

- grass at £/m², plus a waste percentage on the ordered quantity
- sub-base, membrane, sand and labour at £/m²
- edging at £/linear metre, skip as a flat cost
- optional access surcharge as a percentage of the whole job, then any discount
- VAT on top if the business is VAT registered

Job length is `area ÷ m² per crew per day`, rounded up, which is what the scheduler
uses to size a booking.

Change the rates in Settings, not in the code — `DEFAULT_RATES` in `model.js` is only
the starting point for a fresh install.

## Data

Leads, crews and settings live in Supabase (Postgres). Each lead is one row with the
record as `jsonb`, so the shape matches what the app already used. Office devices get
live updates; fitters refresh on focus. `src/db.js` is the only file that talks to the
server. Export a JSON backup from Settings now and then anyway.

Incoming calls are captured automatically: WhatConverts → the `supabase/functions/ingest`
Edge Function → a new lead tagged "Phone call" with its ad attribution. The website
contact form (WPForms) can point at the same endpoint.

## Roadmap

- [x] Quote PDF from the record
- [x] A backend so office and site see the same data (Supabase)
- [x] Auto-capture leads from call tracking / the website form
- [ ] Email the quote straight from the record
- [ ] Photo upload against a job
- [ ] Import historical customers
