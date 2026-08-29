// Business rules: stages, quoting, follow-ups, materials.
// Deliberately free of DOM and of module-level state so it can be unit tested.
import { num, todayISO, addDays, dayDiff } from "./util.js";

export const STAGES = [
  { id: "enquiry",   label: "Enquiry",       chase: 1 },
  { id: "survey",    label: "Survey booked", chase: 0 },
  { id: "surveyed",  label: "Surveyed",      chase: 1 },
  { id: "quoted",    label: "Quoted",        chase: 4 },
  { id: "won",       label: "Won",           chase: 0 },
  { id: "installed", label: "Installed",     chase: 14 },
  { id: "lost",      label: "Lost",          chase: 0 }
];
export const BOARD_STAGES = ["enquiry", "survey", "surveyed", "quoted", "won"];
export const COLD_AFTER_DAYS = 14;

export const stage = (id) => STAGES.find((s) => s.id === id) ?? STAGES[0];

export const DEFAULT_RATES = {
  grasses: [
    { name: "Meadow 30mm", rate: 14.5 },
    { name: "Fairway 35mm", rate: 17.9 },
    { name: "Premier 40mm", rate: 21.5 }
  ],
  wastePct: 10,      // % extra grass ordered to allow for cuts
  subBase: 12.0,     // £/m² — excavation, MOT type 1, grano, compaction
  labour: 18.0,      // £/m²
  membrane: 1.6,     // £/m²
  sand: 1.2,         // £/m² — silica infill
  edging: 6.5,       // £/linear m
  skip: 260,         // £/job
  vatPct: 20,
  m2PerCrewDay: 35   // drives the estimated job length
};

/**
 * Price a job from its survey.
 * @param {object} lead
 * @param {object} rates
 * @param {boolean} vatRegistered — when false, VAT is zero regardless of vatPct
 */
export function quoteFor(lead, rates, vatRegistered = true) {
  const s = lead.survey ?? {};
  const area = num(s.areaM2, 0);
  const wastePct = s.wastePct == null ? num(rates.wastePct, 0) : num(s.wastePct, 0);
  const billable = area * (1 + wastePct / 100);
  const grass = rates.grasses.find((g) => g.name === s.grassSpec) ?? rates.grasses[0] ?? { name: "—", rate: 0 };

  const lines = [];
  const add = (label, detail, amt) => { if (amt > 0.004) lines.push({ label, detail, amt }); };

  add(`Grass — ${grass.name}`, `${billable.toFixed(1)} m² @ £${grass.rate.toFixed(2)}`, billable * grass.rate);
  add("Sub-base & prep", `${area.toFixed(1)} m² @ £${num(rates.subBase).toFixed(2)}`, area * num(rates.subBase));
  if (s.membrane !== false) add("Weed membrane", `${area.toFixed(1)} m²`, area * num(rates.membrane));
  if (s.sand !== false) add("Silica sand infill", `${area.toFixed(1)} m²`, area * num(rates.sand));
  const edge = num(s.edgingM, 0);
  add("Timber edging", `${edge.toFixed(1)} m @ £${num(rates.edging).toFixed(2)}`, edge * num(rates.edging));
  if (s.skip) add("Skip hire & waste removal", "", num(rates.skip));
  add("Installation labour", `${area.toFixed(1)} m² @ £${num(rates.labour).toFixed(2)}`, area * num(rates.labour));
  const extra = num(s.extraCost, 0);
  if (extra) lines.push({ label: s.extraLabel || "Additional works", detail: "", amt: extra });

  let net = lines.reduce((t, l) => t + l.amt, 0);
  const accessPct = num(s.accessPct, 0);
  const access = net * accessPct / 100;
  if (access > 0.004) { lines.push({ label: "Difficult access surcharge", detail: `${accessPct}%`, amt: access }); net += access; }
  const discount = num(s.discount, 0);
  if (discount) { lines.push({ label: "Discount", detail: "", amt: -discount }); net -= discount; }

  const vatPct = vatRegistered ? num(rates.vatPct, 0) : 0;
  const vat = net * vatPct / 100;

  return { lines, net, vat, vatPct, total: net + vat, area, billable, grass, days: estimateDays(area, rates) };
}

export const estimateDays = (area, rates) =>
  Math.max(1, Math.ceil(num(area, 0) / Math.max(1, num(rates.m2PerCrewDay, 35))));

/** Van load list for a job sheet. */
export function materialsFor(lead, rates, vatRegistered = true) {
  const q = quoteFor(lead, rates, vatRegistered);
  const s = lead.survey ?? {};
  const items = [
    { label: q.grass.name, qty: `${q.billable.toFixed(1)} m²` },
    { label: "Sub-base aggregate", qty: `${(q.area * 0.09).toFixed(1)} tonnes approx` }
  ];
  if (s.membrane !== false) items.push({ label: "Weed membrane", qty: `${q.area.toFixed(0)} m²` });
  if (s.sand !== false) items.push({ label: "Silica sand", qty: `${Math.ceil(q.area * 5 / 25)} × 25kg bags` });
  if (num(s.edgingM, 0)) items.push({ label: "Timber edging", qty: `${num(s.edgingM)} m` });
  if (s.skip) items.push({ label: "Skip", qty: "booked" });
  return items;
}

/** Has a sent quote gone quiet? */
export function isCold(lead, today = todayISO()) {
  if (lead.stage !== "quoted") return false;
  const sent = lead.quote?.sentAt || lead.stageAt;
  return sent ? dayDiff(sent, today) >= COLD_AFTER_DAYS : false;
}

/** Where the follow-up on this record stands. Drives the whole chase list. */
export function actionState(lead, today = todayISO()) {
  if (!lead.nextAction) return { kind: "none", label: "No follow-up set", tone: "neutral" };
  const d = dayDiff(today, lead.nextAction);
  if (d < 0) return { kind: "overdue", days: -d, label: `${-d} day${d === -1 ? "" : "s"} overdue`, tone: "crit" };
  if (d === 0) return { kind: "today", label: "Due today", tone: "warn" };
  if (d <= 7) return { kind: "soon", label: `Due ${lead.nextAction}`, tone: "info" };
  return { kind: "later", label: lead.nextAction, tone: "neutral" };
}

export function logActivity(lead, text, at = new Date()) {
  lead.activity ??= [];
  lead.activity.unshift({ ts: at.toISOString(), text });
  if (lead.activity.length > 60) lead.activity.length = 60;
}

/** Move a record along and set the next follow-up the stage implies. */
export function setStage(lead, stageId, today = todayISO()) {
  if (lead.stage === stageId) return;
  const from = stage(lead.stage).label;
  const to = stage(stageId);
  lead.stage = stageId;
  lead.stageAt = today;
  if (stageId === "quoted") { lead.quote ??= {}; lead.quote.sentAt ??= today; }
  if (to.chase > 0) lead.nextAction = addDays(today, to.chase);
  else if (stageId === "won" || stageId === "lost") lead.nextAction = null;
  logActivity(lead, `Stage: ${from} → ${to.label}`);
}

/** Jobs occupying a given crew on a given day — more than one is a clash. */
export function jobsOn(leads, crewId, dayISO) {
  return leads.filter((l) => {
    if (!l.job?.startDate || l.job.crewId !== crewId) return false;
    const offset = dayDiff(l.job.startDate, dayISO);
    return offset >= 0 && offset < (l.job.days || 1);
  });
}
