// Application state: shape, defaults, normalisation, persistence, sample data.
import { uid, todayISO, addDays } from "./util.js";
import { DEFAULT_RATES } from "./model.js";

const STORAGE_KEY = "turfline-state";
export const CREW_COLOURS = ["#2E5D3A", "#7A5C2E", "#3B5F7A", "#6B3F63", "#8F6410", "#3F6B62"];

export function defaultState() {
  return {
    v: 1,
    business: { name: "Yate Artificial Grass", vat: true },
    rates: structuredClone(DEFAULT_RATES),
    crews: [
      { id: "c1", name: "Crew A", colour: CREW_COLOURS[0] },
      { id: "c2", name: "Crew B", colour: CREW_COLOURS[1] }
    ],
    leads: []
  };
}

/** Fill in anything a older or hand-edited save is missing, so views can trust the shape. */
export function normalise(state) {
  const base = defaultState();
  const s = { ...base, ...(state ?? {}) };
  s.business = { ...base.business, ...(s.business ?? {}) };
  s.rates = { ...base.rates, ...(s.rates ?? {}) };
  if (!Array.isArray(s.rates.grasses) || !s.rates.grasses.length) s.rates.grasses = base.rates.grasses;
  if (!Array.isArray(s.crews)) s.crews = base.crews;
  if (!Array.isArray(s.leads)) s.leads = [];
  for (const l of s.leads) {
    l.survey ??= {}; l.quote ??= {}; l.job ??= {}; l.activity ??= [];
  }
  return s;
}

export function newLead(rates) {
  const today = todayISO();
  return {
    id: uid(),
    name: "", phone: "", email: "", address: "", postcode: "",
    source: "", campaign: "",
    stage: "enquiry", createdAt: today, stageAt: today,
    nextAction: addDays(today, 1),
    nextNote: "Call to qualify and book survey",
    survey: { areaM2: "", grassSpec: rates.grasses[0]?.name, wastePct: rates.wastePct, edgingM: "", skip: false, accessPct: 0, notes: "" },
    quote: {}, job: {},
    activity: [{ ts: new Date().toISOString(), text: "Lead created" }]
  };
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalise(JSON.parse(raw)) : null;
  } catch { return null; }
}

export function saveLocal(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}

/** Clearly fictional records, so the app can be judged before real data goes in. */
export function sampleLeads(rates) {
  const t = todayISO();
  const make = (patch) => {
    const l = newLead(rates);
    const { survey, ...rest } = patch;
    Object.assign(l, rest);
    Object.assign(l.survey, survey ?? {});
    return l;
  };
  return [
    make({ name: "Helen Fairbrother", phone: "07700 900412", email: "h.fairbrother@example.co.uk",
      address: "12 Cranleigh Court Road", postcode: "BS37 5DL", source: "Google Ads", campaign: "artificial grass yate",
      stage: "quoted", stageAt: addDays(t, -19), nextAction: addDays(t, -6), nextNote: "Chase quote — comparing with two others",
      survey: { areaM2: 64, grassSpec: "Fairway 35mm", edgingM: 32, skip: true, notes: "Rear garden, side access 900mm. Old lawn to lift." },
      quote: { sentAt: addDays(t, -19) } }),
    make({ name: "Dev Raichura", phone: "07700 900188", address: "Ash Ridge Road, Almondsbury", postcode: "BS32 4EG",
      source: "Google Ads", campaign: "fake grass bristol", stage: "quoted", stageAt: addDays(t, -4),
      nextAction: t, nextNote: "Follow-up call — decision expected this week",
      survey: { areaM2: 38, grassSpec: "Premier 40mm", edgingM: 24, notes: "Dog owner — asked about drainage and cleaning." },
      quote: { sentAt: addDays(t, -4) } }),
    make({ name: "Sunnyside Day Nursery", phone: "01454 900233", email: "office@example.org",
      address: "Station Road, Yate", postcode: "BS37 4AA", source: "Referral", stage: "won", stageAt: addDays(t, -3), nextAction: null,
      survey: { areaM2: 180, grassSpec: "Premier 40mm", edgingM: 70, skip: true, accessPct: 5, notes: "Commercial. Certificate needed for play area. Term-time out of hours." },
      quote: { sentAt: addDays(t, -11) }, job: { crewId: "c1", startDate: addDays(t, 2), days: 5, status: "scheduled" } }),
    make({ name: "Marcus Bell", phone: "07700 900771", address: "Woodlands Road, Chipping Sodbury", postcode: "BS37 6HU",
      source: "Facebook", campaign: "spring offer", stage: "survey", stageAt: addDays(t, -1),
      nextAction: addDays(t, 1), nextNote: "Survey booked 10:30 — take sample pack",
      survey: { grassSpec: "Meadow 30mm" } }),
    make({ name: "Priya Anand", phone: "07700 900556", address: "Peg Hill, Yate", postcode: "BS37 7BW",
      source: "Google Organic", stage: "enquiry", stageAt: t, nextAction: t, nextNote: "New web enquiry — call back today" }),
    make({ name: "Tom & Rachel Whitcombe", phone: "07700 900904", address: "Nibley Lane, Iron Acton", postcode: "BS37 9UD",
      source: "Google Ads", campaign: "artificial grass yate", stage: "won", stageAt: addDays(t, -8), nextAction: null,
      survey: { areaM2: 52, grassSpec: "Fairway 35mm", edgingM: 30, skip: true, notes: "Slope at the top end — needs levelling." },
      quote: { sentAt: addDays(t, -14) }, job: { crewId: "c2", startDate: addDays(t, 1), days: 2, status: "scheduled" } }),
    make({ name: "Gareth Pym", phone: "07700 900318", address: "Badminton Road", postcode: "BS37 6JE",
      source: "Google Ads", campaign: "fake grass bristol", stage: "installed", stageAt: addDays(t, -12),
      nextAction: addDays(t, -1), nextNote: "Aftercare call + ask for a review",
      survey: { areaM2: 41, grassSpec: "Meadow 30mm", edgingM: 26 }, quote: { sentAt: addDays(t, -30) },
      job: { crewId: "c1", startDate: addDays(t, -13), days: 2, status: "complete", completedAt: addDays(t, -12) } }),
    make({ name: "Janice Kerr", phone: "07700 900640", address: "Broad Lane, Yate", postcode: "BS37 7LB",
      source: "Leaflet", stage: "lost", stageAt: addDays(t, -9), nextAction: null,
      survey: { areaM2: 28, grassSpec: "Meadow 30mm" }, quote: { sentAt: addDays(t, -21) } })
  ];
}
