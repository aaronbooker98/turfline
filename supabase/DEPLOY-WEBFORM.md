# Website contact form → CRM (no WhatConverts needed)

Catches the "New Entry: Website Contact Form" emails that land in
**info@yateartificialgrass.com** and drops them into Turfline as leads,
tagged "Web form" — the same way phone calls arrive automatically today.
Free, no new accounts, runs inside Google's own tools.

## Part A — create the script

1. Log into **Gmail as info@yateartificialgrass.com** (in the browser).
2. Go to **script.google.com** → **New project**.
3. Delete the sample `function myFunction() {}` code.
4. Paste in the whole of `supabase/apps-script/website-form-catcher.gs`.
5. On the line near the top starting `var INGEST_URL`, replace `<INGEST_TOKEN>`
   with the real secret (ask Claude for the current value — never commit the
   real value back into the repo file).
6. Click the project name top-left (e.g. "Untitled project") and rename it
   **"Turfline Web Form Catcher"**.
7. **Save** (the disk icon, or Ctrl/Cmd+S).

## Part B — run it once to authorise it, and test

1. At the top, make sure the function dropdown says **checkForms**.
2. Click **Run** (▶).
3. Google will ask to authorise it — click **Continue** / **Advanced** →
   **Go to Turfline Web Form Catcher (unsafe)** → **Allow**. ("Unsafe" just
   means Google hasn't reviewed it — it's your own script, this is normal.)
4. It runs and checks the **Execution log** at the bottom — you should see
   either "Sent to CRM: …" for any unprocessed form email sitting in the
   inbox, or nothing if there isn't one right now.
5. Check **Turfline → Leads** for a new record tagged **Web form**.

## Part C — make it run automatically

1. Left-hand sidebar → the **clock icon** ("Triggers").
2. **+ Add Trigger** (bottom right).
3. Set: Function = **checkForms**, Event source = **Time-driven**,
   Type = **Minutes timer**, Every = **5 minutes**.
4. **Save**.

From now on, every website enquiry lands in the pipeline within a few
minutes, with no one needing to do anything.

## If something looks wrong

- **Nothing arriving:** Apps Script → **Executions** (clock-ish icon in the
  left sidebar, below Triggers) shows every run and any errors.
- **Fields in the wrong place:** the `_raw` data on the created lead
  (visible via a database look, not in the app UI) has the original email
  text — tell me what's off and I'll adjust `parseFormEmail()`.
