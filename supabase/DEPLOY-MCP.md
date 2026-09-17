# Connect the CRM to Claude (MCP connector)

This lets you talk to the CRM from the Claude app — *"book a survey for Sarah
Jones next Wednesday 2pm, BS16 4QP"*, *"what's on this week?"*, *"add to my
to-do: order membrane"*. Claude Pro or above (any paid plan).

## Part A — deploy the function

1. Supabase dashboard → **Edge Functions** → **Deploy a new function** → **Via Editor**
2. Name it exactly: **`mcp`**
3. Delete the sample, paste the whole of `supabase/functions/mcp/index.ts`
4. Turn **"Verify JWT" OFF**
5. **Deploy**

## Part B — add the secret

Edge Functions → **Secrets** → **Add new secret**:

| Name | Value |
|---|---|
| `MCP_KEY` | *(a long random string — ask Claude for the current value, or generate a fresh one and paste it into Settings → Claude connector too. This file must never contain the real value.)* |

(Must match **Settings → Claude connector** in the app.)

## Part C — quick test

Paste this into a terminal (or any REST tool) — it should return a JSON list of tools:

```
curl -s "https://jhkhchhszwmtlhnhmowr.supabase.co/functions/v1/mcp?key=<MCP_KEY>" \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
(swap `<MCP_KEY>` for the real value from Part B)

- JSON with `"tools":[...]` → working ✅
- `{"error":"forbidden"}` → the secret in Part B is wrong or missing

## Part D — add it in Claude

1. In the Claude app (web or phone): **Customize → Connectors**
2. **Add custom connector**
3. **URL:** (the one shown in Settings → Claude connector, once you've pasted
   your `MCP_KEY` in there)
   ```
   https://jhkhchhszwmtlhnhmowr.supabase.co/functions/v1/mcp?key=<MCP_KEY>
   ```
4. Leave Advanced / OAuth settings blank. **Confirm.**
5. It should show "turfline" with a list of tools. Turn it on.

Then in any chat: *"Using turfline, what surveys have I got booked this week?"*

Keep the URL private — anyone with it can change the CRM. To lock it out later,
change `MCP_KEY` (Part B) **and** the key in Settings → Claude connector.

## What Claude can do

Look up leads · full detail on a lead · create a lead · book a survey (into the
diary) · show the diary (surveys + installs) · show what needs chasing · add a
note to a lead · set the next chase date · move a lead's stage · read / add /
tick off to-dos · list unpaid invoices · mark an invoice paid.

## If the in-browser editor isn't available

```
npx supabase login
npx supabase functions deploy mcp --project-ref jhkhchhszwmtlhnhmowr --no-verify-jwt
npx supabase secrets set MCP_KEY=<MCP_KEY> --project-ref jhkhchhszwmtlhnhmowr
```
