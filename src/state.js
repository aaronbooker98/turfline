// Application state: shape, defaults, normalisation.
import { uid, todayISO, addDays } from "./util.js";
import { DEFAULT_RATES } from "./model.js";

export const CREW_COLOURS = ["#2E5D3A", "#7A5C2E", "#3B5F7A", "#6B3F63", "#8F6410", "#3F6B62"];

export function defaultState() {
  return {
    v: 1,
    business: {
      name: "Yate Artificial Grass", vat: true,
      phone: "01454 537330", email: "", address: "", regNo: "",
      quoteValidDays: 30,
      quoteTerms: "Prices include supply, installation and removal of waste. A 25% deposit confirms the booking; the balance is due on completion. Workmanship guaranteed for 5 years. This quote is valid for 30 days."
    },
    rates: structuredClone(DEFAULT_RATES),
    crews: [
      { id: "c1", name: "Crew A", colour: CREW_COLOURS[0] },
      { id: "c2", name: "Crew B", colour: CREW_COLOURS[1] }
    ],
    leads: []
  };
}

/** Fill in anything the server or a hand-edited backup is missing, so views can trust the shape. */
export function normalise(state) {
  const base = defaultState();
  const s = { ...base, ...(state ?? {}) };
  s.business = { ...base.business, ...(s.business ?? {}) };
  s.rates = { ...base.rates, ...(s.rates ?? {}) };
  if (!Array.isArray(s.rates.grasses) || !s.rates.grasses.length) s.rates.grasses = base.rates.grasses;
  if (!Array.isArray(s.crews)) s.crews = base.crews;
  if (!Array.isArray(s.leads)) s.leads = [];
  for (const l of s.leads) {
    l.survey ??= {}; l.quote ??= {}; l.job ??= {}; l.activity ??= []; l.payment ??= {};
    l.channel ??= "manual";
    l.lostReason ??= "";
  }
  return s;
}

const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : uid());

export function newLead(rates) {
  const today = todayISO();
  return {
    id: newId(),
    name: "", phone: "", email: "", address: "", postcode: "",
    source: "", campaign: "",
    channel: "manual",
    stage: "enquiry", createdAt: today, stageAt: today,
    nextAction: addDays(today, 1),
    nextNote: "Call to qualify and book survey",
    lostReason: "",
    survey: { areaM2: "", grassSpec: rates.grasses[0]?.name, wastePct: rates.wastePct, edgingM: "", skip: false, accessPct: 0, notes: "" },
    quote: {}, job: {}, payment: {},
    activity: [{ ts: new Date().toISOString(), text: "Lead created" }]
  };
}
