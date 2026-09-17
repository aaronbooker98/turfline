# Deploy the calendar feed (Edge Function)

This gives you one link you subscribe to in your phone's calendar. Every booked
**survey** and every **install** then shows up in your normal diary and keeps
itself up to date.

## 1. Create the function

1. Supabase dashboard → **Edge Functions**
2. **Deploy a new function** → **Via Editor**
3. Name it exactly: **`calendar`**
4. Delete the sample code, paste the whole of
   `supabase/functions/calendar/index.ts`
5. Turn **"Verify JWT" OFF** (calendar apps can't log in; the `?token=` guards it)
6. **Deploy**

## 2. Add the secret

Edge Functions → **Secrets** → **Add new secret**:

| Name | Value |
|---|---|
| `CALENDAR_TOKEN` | *(a long random string — ask Claude for the current value, or generate a fresh one and paste it into Settings → Calendar sync too. This file must never contain the real value.)* |

(This must match the token in **Settings → Calendar sync** in the app. If you
change one, change the other.)

## 3. Subscribe

The feed URL (also shown in **Settings → Calendar sync**, which builds it from
the key you paste in there — never commit the real value into this file):

```
https://jhkhchhszwmtlhnhmowr.supabase.co/functions/v1/calendar?token=<CALENDAR_TOKEN>
```

- **Google Calendar** (do this on a computer): left sidebar → **Other calendars**
  → **+** → **From URL** → paste → **Add calendar**. It shows on your phone's
  Google Calendar app within a few hours and refreshes itself daily.
- **Apple Calendar** (iPhone): Settings app → **Calendar** → **Accounts** →
  **Add Account** → **Other** → **Add Subscribed Calendar** → paste the URL.

Keep the link private — anyone with it can see the diary.

## If the in-browser editor isn't available

```
npx supabase login
npx supabase functions deploy calendar --project-ref jhkhchhszwmtlhnhmowr --no-verify-jwt
npx supabase secrets set CALENDAR_TOKEN=<CALENDAR_TOKEN> --project-ref jhkhchhszwmtlhnhmowr
```
