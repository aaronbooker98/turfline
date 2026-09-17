# Deploy the lead catcher (Edge Function)

This is the endpoint WhatConverts (and later WPForms) POST new leads to.

## 1. Create the function

1. Supabase dashboard → left menu → **Edge Functions**
2. **Deploy a new function** → choose **Via Editor** (in-browser)
3. Name it exactly: **`ingest`**
4. Delete the sample code, paste the entire contents of
   `supabase/functions/ingest/index.ts`
5. If there's a **"Verify JWT"** switch, turn it **OFF** (the webhook has no login;
   the `?token=` in the URL is the guard). If you don't see it now, set it after
   deploy under the function's **Details → Settings**.
6. **Deploy**

## 2. Add the secret

Edge Functions → **Secrets** (or **Manage secrets**) → **Add new secret**:

| Name | Value |
|---|---|
| `INGEST_TOKEN` | *(a long random string — ask Claude for the current value, or generate a fresh one and update the webhook URL below to match. This file must never contain the real value.)* |

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already there automatically.)

## 3. The webhook URL

Give this to WhatConverts (and it's what the Gmail web-form catcher uses too):

```
https://jhkhchhszwmtlhnhmowr.supabase.co/functions/v1/ingest?token=<INGEST_TOKEN>
```

Replace `<INGEST_TOKEN>` with the actual secret value from step 2 — ask Claude
for the current one. **Never commit the real value into this file or any
other file in the repo — it's public.**

## 4. Point WhatConverts at it

WhatConverts → Webhooks → Add Webhook:
- **Webhook URL:** the URL above
- **Trigger:** "When a new lead is received" (leave "when changes are made" off)
- **Next Step → Lead types:** tick **Phone Call** and **Web Form**
- Save

## 5. Test

WhatConverts webhooks have a test/send option, or make a test call to your
tracking number. A new lead should appear in Turfline → Leads within a few
seconds, tagged "Phone call" with the source.

The first real lead stores its full raw payload (`data._raw` on the lead row) —
that lets the field mapping be tightened to WhatConverts' exact format.

## If the in-browser editor isn't available

From a terminal in the project folder:

```
npx supabase login
npx supabase functions deploy ingest --project-ref jhkhchhszwmtlhnhmowr --no-verify-jwt
npx supabase secrets set INGEST_TOKEN=<INGEST_TOKEN> --project-ref jhkhchhszwmtlhnhmowr
```
