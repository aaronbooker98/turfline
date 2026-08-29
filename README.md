# Turfline

CRM and job management for an artificial grass installation business. Built around the
two things that actually cost money: quotes that go unchased, and installs that clash.

No framework, no build step, no dependencies. Plain ES modules, so what you read is
what runs in the browser.

## Running it

```bash
npm start          # http://localhost:5173
npm test           # unit tests for the pricing and scheduling rules
```

`npm start` serves the folder over http, which ES modules need — opening `index.html`
straight off disk will not work.

## What's where

```
index.html            page shell; loads fonts and src/app.js
dev-server.js         20-line static server, no dependencies
src/
  app.js              routing, event delegation, persistence
  model.js            the business rules — quoting, stages, follow-ups, clashes
  state.js            state shape, defaults, localStorage, sample data
  util.js             dates, money, escaping
  icons.js            inline SVG
  styles.css          design tokens and every component
  views/              one module per screen
test/
  model.test.js       covers model.js — run before you change pricing
```

`model.js` has no DOM in it on purpose: everything that decides money or dates is
testable without a browser. If you change how a job is priced, change it there and
add a test.

## Screens

- **Today** — overdue and due-today follow-ups, plus installs in the next week.
  Quotes with no movement for 14 days are flagged cold.
- **Pipeline** — board by stage with values, source and search.
- **Schedule** — crews across a week. Two jobs on one crew on one day turn red.
- **Job sheets** — phone view for fitters: address, spec, materials to load, mark complete.
- **Settings** — rates that drive every quote, crews, export/import.

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

Everything lives in `localStorage` in the browser that entered it. That is fine for one
or two people on one machine and not fine for a crew spread across phones — which is
the next thing to fix. Export a backup from Settings regularly until there's a server.

## Roadmap

- [ ] Quote PDF, emailed from the record
- [ ] A backend so office and site see the same data (Postgres + a small API)
- [ ] Photo upload against a job
- [ ] Import from Zoho CRM
