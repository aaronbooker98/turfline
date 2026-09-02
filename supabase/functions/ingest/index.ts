// Turfline lead catcher.
// Receives a webhook POST (WhatConverts now; WPForms later), turns it into a
// Turfline lead, and inserts it into the `leads` table with the service role.
//
// Deploy in the Supabase dashboard: Edge Functions -> Create function -> name it
// "ingest" -> paste this file -> turn OFF "Verify JWT" -> Deploy.
// Then add a secret INGEST_TOKEN (any long random string) under
// Edge Functions -> Secrets. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// provided automatically.
//
// Webhook URL to give WhatConverts:
//   https://<project>.functions.supabase.co/ingest?token=<INGEST_TOKEN>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN = Deno.env.get("INGEST_TOKEN") ?? "";

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (!TOKEN || url.searchParams.get("token") !== TOKEN) return json({ error: "forbidden" }, 403);
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }

  const p = body as Record<string, any>;
  const pick = (...keys: string[]) => {
    for (const k of keys) { const v = p[k]; if (v != null && v !== "") return String(v); }
    return "";
  };

  if (p.spam === true || p.spam === "true") return json({ ok: true, skipped: "spam" });

  const type = pick("lead_type", "leadType").toLowerCase();
  const channel = type.includes("call") ? "phone"
    : type.includes("form") || type.includes("chat") || type.includes("text") ? "web"
    : "manual";

  const src = pick("lead_source", "source").toLowerCase();
  const medium = pick("lead_medium", "medium").toLowerCase();
  const keyword = pick("lead_keyword", "keyword");
  const landing = pick("landing_url", "landing_page_url", "landing_page");
  const paid = !!pick("gclid", "wbraid", "gbraid", "msclkid", "fbclid")
    || ["cpc", "ppc", "paid", "paidsearch", "paid_search"].includes(medium);
  const channelWord = (() => {
    const s = src ? src[0].toUpperCase() + src.slice(1) : "";
    if (!s) return paid ? "Adwords" : "";
    if (paid) return `${s} Adwords`;
    if (medium === "organic") return `${s} Organic`;
    if (["referral", "social"].includes(medium)) return `${s} ${medium}`;
    return s;
  })();
  // Source = where the lead came through (WhatConverts). The marketing detail
  // (Google Ads, keyword, campaign) goes in the Campaign field so nothing is lost.
  const source = "WhatConverts";
  const campaign = [channelWord, pick("lead_campaign", "campaign"), keyword]
    .filter(Boolean).join(" · ");

  const extId = "wc:" + (pick("lead_id", "leadId", "id") || crypto.randomUUID());
  const now = new Date().toISOString();

  // pull a message out of web-form submissions if present
  let message = pick("notes", "message", "comments", "comment");
  const extra = p.additional_fields ?? p.form_data ?? p.fields;
  if (!message && Array.isArray(extra)) {
    const m = extra.find((f: any) => /message|comment|enquiry|details/i.test(f?.name ?? f?.label ?? ""));
    if (m) message = String(m.value ?? m.content ?? "");
  }

  const phone = pick("phone_number", "caller_number", "contact_phone", "contact_number");
  const city = pick("contact_city", "caller_city");
  const region = pick("contact_state", "caller_state");
  const country = pick("contact_country", "caller_country");
  // Call tracking drops the caller's location (often just "United Kingdom") into
  // the name field when it can't identify them — don't let that become the name.
  const rawName = pick("contact_name", "caller_name", "name").trim();
  const NOT_A_NAME = /^(united kingdom|england|scotland|wales|northern ireland|great britain|uk|unknown( caller)?|not provided|no name|n\/?a|none|null|anonymous|wireless caller|withheld|private|caller)$/i;
  const nameIsJunk = !rawName
    || NOT_A_NAME.test(rawName)
    || [city, region, country].some((g) => g && g.toLowerCase() === rawName.toLowerCase())
    || (city && region && rawName.toLowerCase() === `${city}, ${region}`.toLowerCase());
  const name = nameIsJunk ? (phone ? `Caller ${phone}` : "Phone enquiry") : rawName;

  const lead = {
    name,
    phone,
    email: pick("email_address", "contact_email_address", "contact_email", "email"),
    address: [city, region].filter(Boolean).join(", "),
    postcode: pick("contact_zip", "contact_postcode", "postal_code", "postcode"),
    source,
    campaign,
    channel,
    stage: "enquiry",
    createdAt: todayISO(),
    stageAt: todayISO(),
    nextAction: addDaysISO(1),
    nextNote: channel === "phone"
      ? `Call back${keyword ? ` — searched "${keyword}"` : landing ? ` — from ${landing}` : ""}`
      : "Website enquiry — reply",
    survey: { areaM2: "", grassSpec: "", accessPct: 0, notes: message || "" },
    quote: {}, job: {},
    activity: [{ ts: now, text: `Captured from WhatConverts (${type || "lead"})` }],
    _ext: extId,
    _raw: body            // kept so the mapping can be tuned against a real payload
  };

  const { data: existing } = await db.from("leads").select("id,data").filter("data->>_ext", "eq", extId).maybeSingle();
  if (existing) {
    const merged = { ...(existing.data as object), ...lead, activity: (existing.data as any).activity ?? lead.activity };
    const { error } = await db.from("leads").update({ data: merged }).eq("id", existing.id);
    return error ? json({ error: error.message }, 500) : json({ ok: true, updated: existing.id });
  }

  const { data, error } = await db.from("leads").insert({ data: lead }).select("id").single();
  return error ? json({ error: error.message }, 500) : json({ ok: true, id: data.id });
});
