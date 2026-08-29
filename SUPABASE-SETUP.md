# Supabase setup — do this once

Project: **jhkhchhszwmtlhnhmowr** (dashboard: https://supabase.com/dashboard/project/jhkhchhszwmtlhnhmowr)

## 1. Create the database tables

1. In the Supabase dashboard, left menu → **SQL Editor**
2. Click **+ New query**
3. Open the file `supabase/setup.sql` from this project, copy **all** of it
4. Paste into the query box, click **Run** (bottom right)
5. It should finish with "Success. No rows returned"

This creates the tables, the two-role security rules, and the starting data
(business settings + Crew A / Crew B). No sample leads — you start clean.

## 2. Turn off email confirmation

The two logins are created by hand, not by people signing up, so no confirmation
emails are needed.

1. Left menu → **Authentication** → **Sign In / Providers** (or **Providers → Email**)
2. Find **Confirm email** and turn it **OFF**
3. Save

## 3. Create the two logins

Left menu → **Authentication** → **Users** → **Add user** → **Create new user**.

Do this **twice**:

| Email | Password | Becomes |
|---|---|---|
| `office@yateartificialgrass.com` | *(pick a strong one)* | Office — full access |
| `fitters@yateartificialgrass.com` | *(a different one)* | Fitters — job sheets only |

- Tick **Auto Confirm User?** for both.
- The email **does not need to be a real inbox** — it's just the login name. The
  `office@` one automatically gets the office role; anything else gets fitters.
- **Write both passwords down somewhere safe.** With made-up emails there's no
  "forgot password" — if lost, you reset it from this same Users screen.

## 4. Tell me it's done

Once the SQL has run and both users exist, say so and I'll point the live app at
it. Then we test together before it's the real thing.

---

### What the two logins can do

| | Office | Fitters |
|---|---|---|
| Today, Leads, Pipeline, Analytics | ✅ | ❌ hidden |
| Schedule | ✅ edit | 👁️ view |
| Job sheets | ✅ | ✅ (scheduled jobs only) |
| Quote £ amounts, rates, settings | ✅ | ❌ never sent to their device |
| Mark a job complete | ✅ | ✅ |

The fitters login physically cannot pull pipeline or money data — the security
rules block it at the database, not just in the screen.
