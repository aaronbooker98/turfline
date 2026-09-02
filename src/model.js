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

// How the enquiry first reached us. Auto-capture sets phone/web; office sets manual.
export const CHANNELS = [
  { id: "manual", label: "Manual" },
  { id: "phone", label: "Phone call" },
  { id: "web", label: "Web form" }
];
export const channelLabel = (id) => (CHANNELS.find((c) => c.id === id) ?? CHANNELS[0]).label;

export const LOST_REASONS = ["Price", "Timing", "Went elsewhere", "No response", "Changed their mind", "Other"];

export const stage = (id) => STAGES.find((s) => s.id === id) ?? STAGES[0];

// Values that call-tracking drops in when it can't identify the caller.
const NOT_A_NAME = /^(united kingdom|england|scotland|wales|northern ireland|great britain|uk|unknown( caller)?|not provided|no name|n\/?a|none|null|anonymous|wireless caller|withheld|private|caller)$/i;

/** What to show for a lead: their name, or their number if we don't have a name yet. */
export function leadName(lead) {
  const n = String(lead?.name || "").trim();
  if (n && !NOT_A_NAME.test(n)) return n;
  const phone = String(lead?.phone || "").trim();
  return phone || "Phone enquiry";
}

/** Other records that might be the same enquiry — same phone, or same
 *  postcode + name. Used for a non-blocking "possible duplicate" nudge. */
export function dedupeMatches(lead, leads) {
  const digits = (s) => String(s || "").replace(/\D/g, "");
  const pc = (s) => String(s || "").replace(/\s+/g, "").toUpperCase();
  const myPhone = digits(lead.phone);
  const myPc = pc(lead.postcode);
  const myName = String(lead.name || "").trim().toLowerCase();
  return leads.filter((l) => {
    if (l.id === lead.id) return false;
    if (myPhone.length >= 6 && digits(l.phone).endsWith(myPhone.slice(-9))) return true;
    if (myPc.length >= 5 && pc(l.postcode) === myPc && myName && String(l.name || "").trim().toLowerCase() === myName) return true;
    return false;
  });
}

/** Deposit / balance position for a won job priced at `total`. */
export function paymentState(lead, total) {
  const p = lead.payment ?? {};
  const deposit = Math.min(num(p.deposit, 0), total || num(p.deposit, 0));
  const balance = Math.max(0, (total || 0) - deposit);
  const received = (p.depositPaid ? deposit : 0) + (p.balancePaid ? balance : 0);
  return {
    deposit, balance, received,
    depositPaid: !!p.depositPaid,
    balancePaid: !!p.balancePaid,
    outstanding: Math.max(0, (total || 0) - received),
    settled: !!p.balancePaid || ((total || 0) > 0 && received >= (total || 0) - 0.5)
  };
}

/** Net / VAT / total for an invoice. `amount` is what was typed; `amountIncVat`
 *  says whether that figure already includes VAT; `vat:false` zero-rates it. */
export function invoiceTotals(inv, vatPct = 20) {
  const amount = num(inv?.amount, 0);
  const rate = inv?.vat === false ? 0 : num(vatPct, 0);
  if (!rate) return { net: amount, vat: 0, total: amount, rate: 0 };
  if (inv?.amountIncVat !== false) {
    const net = amount / (1 + rate / 100);
    return { net, vat: amount - net, total: amount, rate };
  }
  return { net: amount, vat: amount * rate / 100, total: amount * (1 + rate / 100), rate };
}

export const DEFAULT_RATES = {
  grasses: [
    { name: "Standard 30mm", rate: 12.0 }
  ],
  wastePct: 10,      // % extra grass ordered to allow for cuts (materials list only)
  // Groundworks & materials — £ per m² of area. Each can be switched off per job.
  type1: 6.0,        // Type 1 sub-base (75mm)
  stoneDust: 2.25,   // Stone dust blinding (25mm)
  muckaway: 4.25,    // Excavate & cart waste away (6.8t)
  membrane: 0.45,    // Weed membrane
  sand: 0.96,        // Kiln-dried sand infill
  joins: 0.25,       // Joining tape & glue
  edging: 2.6,       // Edging
  // Always on the job — £ per m²
  labour: 10.5,      // Crew labour (£420 per crew day ÷ 40 m²)
  vans: 0.66,        // Vans / fuel — flat £/m² (48 mi/job @ 55p ÷ 40 m²/day)
  mileageRate: 0.55, // £ per mile — HMRC approved rate, for the "by mileage" option
  sundries: 1.5,     // Sundries
  marginPct: 40,     // markup added to cost to reach the price (ex VAT)
  vatPct: 20,
  m2PerCrewDay: 40,  // drives the estimated job length
  type1Depth: 75,      // mm — used to work out the aggregate tonnage
  stoneDustDepth: 25,  // mm
  muckawayDepth: 150   // mm — total dig-out depth, drives the muck-away tonnage
};

// Compacted supply density, tonnes per m³.
const AGG_DENSITY = { type1: 2.0, stoneDust: 1.75, spoil: 1.6 };

/** Rough aggregate tonnage for a job: Type 1 and stone dust going in, spoil
 *  (turf strip + the build-up depth) coming out as muck-away. Estimates only. */
export function aggregatesFor(area, rates) {
  const a = Math.max(0, num(area, 0));
  const t1 = num(rates.type1Depth, 75) / 1000;
  const dust = num(rates.stoneDustDepth, 25) / 1000;
  const digM = (num(rates.muckawayDepth, 0) / 1000) || (t1 + dust + 0.04); // dig-out depth
  const type1 = a * t1 * AGG_DENSITY.type1;
  const stoneDust = a * dust * AGG_DENSITY.stoneDust;
  const muckaway = a * digM * AGG_DENSITY.spoil;
  return { type1, stoneDust, muckaway, digDepthMm: Math.round(digM * 1000) };
}

/** Kiln-dried sand infill: one 25kg bag per 4 m². */
export const sandBagsFor = (area) => Math.ceil(Math.max(0, num(area, 0)) / 4);

// The switchable groundworks/materials lines, in the order they appear on a quote.
// Each is keyed the same in `rates` (£/m²) and in `survey` (true/false, absent = on).
export const WORKS = [
  ["type1", "Type 1 sub-base"],
  ["stoneDust", "Stone dust blinding"],
  ["muckaway", "Excavate & cart waste away"],
  ["membrane", "Weed membrane"],
  ["sand", "Sand infill"],
  ["joins", "Joining tape & glue"],
  ["edging", "Edging"]
];
export const workIsOn = (survey, key) => (survey ?? {})[key] !== false;

/**
 * Price a job from its survey. Everything is £/m² of surveyed area; the sum of
 * the per-m² lines is the cost, then a margin % is added to reach the price.
 * @param {object} lead
 * @param {object} rates
 * @param {boolean} vatRegistered — when false, VAT is zero regardless of vatPct
 */
export function quoteFor(lead, rates, vatRegistered = true) {
  const s = lead.survey ?? {};
  const area = num(s.areaM2, 0);
  const billable = area * (1 + num(rates.wastePct, 0) / 100);
  const grass = rates.grasses.find((g) => g.name === s.grassSpec) ?? rates.grasses[0] ?? { name: "—", rate: 0 };

  // Days on site: the booked job length, an estimator override, or an estimate.
  const days = num(lead.job?.days, 0) || num(s.crewDays, 0) || estimateDays(area, rates);

  const lines = [];
  const per = (rate) => `${area.toFixed(1)} m² @ £${num(rate).toFixed(2)}`;
  const cost = (label, rate) => { const amt = area * num(rate); if (amt > 0.004) lines.push({ label, detail: per(rate), amt, grp: "cost" }); };

  cost(`Grass — ${grass.name}`, grass.rate);
  for (const [key, label] of WORKS) if (workIsOn(s, key)) cost(label, rates[key]);
  // Crew labour: a per-job day rate × days on site overrides the per-m² default.
  const dayRate = num(s.crewDayRate, 0);
  if (dayRate > 0) {
    const amt = dayRate * days;
    if (amt > 0.004) lines.push({ label: "Crew labour", detail: `${days} day${days > 1 ? "s" : ""} @ £${dayRate.toFixed(2)}`, amt, grp: "cost" });
  } else {
    cost("Crew labour", rates.labour);
  }
  // Vans & fuel: a per-job lump (worked out from mileage) overrides the per-m² default.
  if (s.vanCost != null && s.vanCost !== "") {
    const amt = num(s.vanCost, 0);
    if (amt > 0.004) lines.push({ label: "Vans & fuel", detail: s.vanNote || "by mileage", amt, grp: "cost" });
  } else {
    cost("Vans & fuel", rates.vans);
  }
  cost("Sundries", rates.sundries);

  const costTotal = lines.reduce((t, l) => t + l.amt, 0);
  // Margin: a per-job override (from the estimator) or the standard rate.
  const marginPct = (s.marginPct != null && s.marginPct !== "") ? num(s.marginPct) : num(rates.marginPct, 0);
  const margin = costTotal * marginPct / 100;
  if (margin > 0.004) lines.push({ label: "Margin", detail: `${marginPct}%`, amt: margin, grp: "after" });

  const accessPct = num(s.accessPct, 0);
  const access = (costTotal + margin) * accessPct / 100;
  if (access > 0.004) lines.push({ label: "Difficult access surcharge", detail: `${accessPct}%`, amt: access, grp: "after" });

  const coreNet = costTotal + margin + access;
  const extra = num(s.extraCost, 0);
  const discount = num(s.discount, 0);
  if (extra) lines.push({ label: s.extraLabel || "Additional works", detail: "", amt: extra, grp: "after" });
  if (discount) lines.push({ label: "Discount", detail: "", amt: -discount, grp: "after" });

  const net = coreNet + extra - discount;
  const vatPct = vatRegistered ? num(rates.vatPct, 0) : 0;
  const vat = net * vatPct / 100;

  // What the customer sees on the printed quote: one supply-&-install line.
  const custLines = [{
    label: `Supply & installation of ${area || 0} m² artificial grass${grass.name && grass.name !== "—" ? ` (${grass.name})` : ""}`,
    detail: area ? `about ${days} working day${days > 1 ? "s" : ""} on site` : "",
    amt: coreNet
  }];
  if (extra) custLines.push({ label: s.extraLabel || "Additional works", detail: "", amt: extra });
  if (discount) custLines.push({ label: "Discount", detail: "", amt: -discount });

  return { lines, custLines, cost: costTotal, margin, net, vat, vatPct, total: net + vat, area, billable, grass, days };
}

export const estimateDays = (area, rates) =>
  Math.max(1, Math.ceil(num(area, 0) / Math.max(1, num(rates.m2PerCrewDay, 40))));

/** Van load list for a job sheet. */
export function materialsFor(lead, rates, vatRegistered = true) {
  const q = quoteFor(lead, rates, vatRegistered);
  const s = lead.survey ?? {};
  const on = (k) => workIsOn(s, k);
  const agg = aggregatesFor(q.area, rates);
  const items = [{ label: q.grass.name, qty: `${q.billable.toFixed(1)} m²` }];
  if (on("type1")) items.push({ label: `Type 1 sub-base (${num(rates.type1Depth, 75)}mm)`, qty: `${agg.type1.toFixed(1)} t approx` });
  if (on("stoneDust")) items.push({ label: `Stone dust (${num(rates.stoneDustDepth, 25)}mm)`, qty: `${agg.stoneDust.toFixed(1)} t approx` });
  if (on("membrane")) items.push({ label: "Weed membrane", qty: `${q.area.toFixed(0)} m²` });
  if (on("sand")) items.push({ label: "Kiln-dried sand", qty: `${sandBagsFor(q.area)} × 25kg bags` });
  if (on("joins")) items.push({ label: "Joining tape & glue", qty: "as needed" });
  if (on("edging")) items.push({ label: "Edging", qty: `${Math.ceil(4 * Math.sqrt(q.area || 0))} m approx` });
  if (on("muckaway")) items.push({ label: "Muck-away", qty: `${agg.muckaway.toFixed(1)} t approx` });
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

/** Leads with a survey appointment that hasn't been written up yet, soonest first.
 *  `overdue` = the appointment time has passed and they're still not surveyed. */
export function bookedSurveys(leads, today = todayISO()) {
  return leads
    .filter((l) => l.survey?.bookedFor && ["enquiry", "survey"].includes(l.stage))
    .map((l) => {
      const day = String(l.survey.bookedFor).slice(0, 10);
      return { lead: l, when: l.survey.bookedFor, day, overdue: day < today };
    })
    .sort((a, b) => (a.when < b.when ? -1 : a.when > b.when ? 1 : 0));
}

/** Jobs occupying a given crew on a given day — more than one is a clash. */
export function jobsOn(leads, crewId, dayISO) {
  return leads.filter((l) => {
    if (!l.job?.startDate || l.job.crewId !== crewId) return false;
    const offset = dayDiff(l.job.startDate, dayISO);
    return offset >= 0 && offset < (l.job.days || 1);
  });
}
