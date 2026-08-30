// Supabase data layer. Everything that talks to the server lives here so the
// rest of the app stays close to what it was: mutate `state`, call save().
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm";

const SUPABASE_URL = "https://jhkhchhszwmtlhnhmowr.supabase.co";
const SUPABASE_KEY = "sb_publishable_c8Cc7MXwv4JsYPYwfSsulw_4rYO23pZ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "turfline-auth" }
});

const json = (v) => JSON.stringify(v ?? null);

/* ---------------- auth ---------------- */

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new Error(error.message);
}

export const signOut = () => supabase.auth.signOut();

export function onAuthChange(cb) {
  return supabase.auth.onAuthStateChange((_e, session) => cb(session));
}

/** 'office' | 'fitters' | 'none' */
export async function myRole() {
  const { data, error } = await supabase.rpc("app_role");
  if (error || !data) return "none";
  return data;
}

/* ---------------- shape helpers ---------------- */

const rowToLead = (row) => ({ id: row.id, ...row.data });
const leadToRow = (lead) => { const { id, ...data } = lead; return { id, data }; };

/* ---------------- office: full state ---------------- */

export async function loadOfficeState() {
  const [settings, crews, leads] = await Promise.all([
    supabase.from("app_settings").select("business,rates").eq("id", 1).single(),
    supabase.from("crews").select("id,name,colour,sort").order("sort"),
    supabase.from("leads").select("id,data").order("updated_at", { ascending: false })
  ]);
  for (const r of [settings, crews, leads]) if (r.error) throw new Error(r.error.message);
  return {
    business: settings.data.business,
    rates: settings.data.rates,
    crews: crews.data.map((c) => ({ id: c.id, name: c.name, colour: c.colour })),
    leads: leads.data.map(rowToLead)
  };
}

/** Write only what changed since the last push. `prev` is the last-saved snapshot. */
export async function pushState(state, prev) {
  const ops = []; // each returns a supabase query promise

  if (json(state.business) !== json(prev?.business) || json(state.rates) !== json(prev?.rates))
    ops.push(() => supabase.from("app_settings").update({ business: state.business, rates: state.rates }).eq("id", 1));

  const prevCrew = new Map((prev?.crews ?? []).map((c) => [c.id, json(c)]));
  const nextCrewIds = new Set(state.crews.map((c) => c.id));
  const crewRows = [];
  state.crews.forEach((c, i) => {
    if (prevCrew.get(c.id) !== json(c)) crewRows.push({ id: c.id, name: c.name, colour: c.colour, sort: i });
  });
  if (crewRows.length) ops.push(() => supabase.from("crews").upsert(crewRows, { onConflict: "id" }));
  for (const id of prevCrew.keys())
    if (!nextCrewIds.has(id)) ops.push(() => supabase.from("crews").delete().eq("id", id));

  const prevLead = new Map((prev?.leads ?? []).map((l) => [l.id, json(l)]));
  const nextLeadIds = new Set(state.leads.map((l) => l.id));
  const leadRows = [];
  for (const l of state.leads)
    if (prevLead.get(l.id) !== json(l)) leadRows.push(leadToRow(l));
  if (leadRows.length) ops.push(() => supabase.from("leads").upsert(leadRows, { onConflict: "id" }));
  for (const id of prevLead.keys())
    if (!nextLeadIds.has(id)) ops.push(() => supabase.from("leads").delete().eq("id", id));

  for (const run of ops) {
    const { error } = await run();
    if (error) throw new Error(error.message);
  }
}

export function subscribeOffice(onChange) {
  const ch = supabase
    .channel("turfline-office")
    .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "crews" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(ch);
}

/* ---------------- fitters: job sheets only ---------------- */

export async function loadFittersState() {
  const [sheets, crews] = await Promise.all([
    supabase.rpc("get_job_sheets"),
    supabase.from("crews").select("id,name,colour,sort").order("sort")
  ]);
  for (const r of [sheets, crews]) if (r.error) throw new Error(r.error.message);
  const rows = sheets.data ?? [];
  // Grass names only (no prices) so the job sheet can name the spec and materials.
  const grasses = [...new Set(rows.map((r) => r.survey?.grassSpec).filter(Boolean))]
    .map((name) => ({ name, rate: 0 }));
  return {
    business: { name: "Yate Artificial Grass", vat: false },
    rates: { grasses, wastePct: 10, m2PerCrewDay: 40 },
    crews: crews.data.map((c) => ({ id: c.id, name: c.name, colour: c.colour })),
    leads: rows.map((r) => ({
      id: r.id, name: r.name, address: r.address, postcode: r.postcode, phone: r.phone,
      source: "", campaign: "", stage: "won", createdAt: null, stageAt: null,
      nextAction: null, nextNote: "",
      survey: coerceSurvey(r.survey), quote: {}, job: coerceJob(r.job), activity: []
    }))
  };
}

const numOrEmpty = (v) => (v == null || v === "" ? "" : Number(v));
function coerceSurvey(s = {}) {
  // Carry the raw survey through (works toggles are booleans, absent = on) and
  // normalise just the fields the job sheet / materials list read directly.
  return { ...s, areaM2: numOrEmpty(s.areaM2), grassSpec: s.grassSpec ?? "", notes: s.notes ?? "", accessPct: 0 };
}
function coerceJob(j = {}) {
  return {
    crewId: j?.crewId ?? "", startDate: j?.startDate ?? "",
    days: j?.days == null || j.days === "" ? 1 : Number(j.days),
    status: j?.status ?? "scheduled", completedAt: j?.completedAt ?? ""
  };
}

export async function markComplete(id) {
  const { error } = await supabase.rpc("mark_job_complete", { p_id: id });
  if (error) throw new Error(error.message);
}
