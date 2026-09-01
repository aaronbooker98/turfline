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
| `CALENDAR_TOKEN` | `cal_yag_7c1f9e4a2d8b6035` |

(This must match the token in **Settings → Calendar sync** in the app. If you
change one, change the other.)

## 3. Subscribe

The feed URL (also shown in **Settings → Calendar sync**):

```
https://jhkhchhszwmtlhnhmowr.supabase.co/functions/v1/calendar?token=cal_yag_7c1f9e4a2d8b6035
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
npx supabase secrets set CALENDAR_TOKEN=cal_yag_7c1f9e4a2d8b6035 --project-ref jhkhchhszwmtlhnhmowr
```
