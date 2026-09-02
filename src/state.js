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
      quoteTerms: "Prices include supply, installation and removal of waste. A 25% deposit confirms the booking; the balance is due on completion. Workmanship guaranteed for 5 years. This quote is valid for 30 days.",
      legalName: "Yate Artificial Grass Ltd",
      bankName: "Lloyds Bank", sortCode: "30-99-50", accountNo: "56818060",
      vatNo: "460380900",
      invoiceTerms: "PAYMENT DUE ON RECEIPT OF INVOICE",
      invoiceFoot: "OR CASH + CHEQUE ACCEPTED",
      nextInvoiceNo: 261,
      reviewUrl: "",
      calendarToken: "cal_yag_7c1f9e4a2d8b6035",
      mcpKey: "mcp_yag_3f8a1c95e07d42b6a9f4c1e8",
      todos: []
    },
    rates: structuredClone(DEFAULT_RATES),
    crews: [
      { id: "c1", name: "Crew A", colour: CREW_COLOURS[0] },
      { id: "c2", name: "Crew B", colour: CREW_COLOURS[1] }
    ],
    leads: [],
    invoices: []
  };
}

/** Fill in anything the server or a hand-edited backup is missing, so views can trust the shape. */
export function normalise(state) {
  const base = defaultState();
  const s = { ...base, ...(state ?? {}) };
  s.business = { ...base.business, ...(s.business ?? {}) };
  if (!Array.isArray(s.business.todos)) s.business.todos = [];
  s.rates = { ...base.rates, ...(s.rates ?? {}) };
  if (!Array.isArray(s.rates.grasses) || !s.rates.grasses.length) s.rates.grasses = base.rates.grasses;
  if (!Array.isArray(s.crews)) s.crews = base.crews;
  if (!Array.isArray(s.leads)) s.leads = [];
  if (!Array.isArray(s.invoices)) s.invoices = [];
  for (const l of s.leads) {
    l.survey ??= {}; l.quote ??= {}; l.job ??= {}; l.activity ??= []; l.payment ??= {};
    l.channel ??= "manual";
    l.lostReason ??= "";
  }
  for (const inv of s.invoices) {
    inv.billTo ??= { name: "", address: "", email: "", phone: "" };
    inv.billTo.email ??= "";
    inv.billTo.phone ??= "";
    inv.description ??= "Artificial Grass Supply + fit";
    if (inv.amountIncVat == null) inv.amountIncVat = true;
    if (inv.vat == null) inv.vat = true;
  }
  return s;
}

const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : uid());

/** A blank invoice, optionally pre-filled from a won/finished job. */
export function newInvoice(state, lead = null) {
  const number = Math.max(261, Math.floor(Number(state.business?.nextInvoiceNo) || 261));
  state.business.nextInvoiceNo = number + 1;
  const inv = {
    id: newId(),
    number,
    date: todayISO(),
    billTo: { name: "", address: "", email: "", phone: "" },
    leadId: lead?.id ?? null,
    description: "Artificial Grass Supply + fit",
    amount: "",
    amountIncVat: true,
    vat: state.business?.vat !== false,
    paid: false, paidAt: null,
    createdAt: new Date().toISOString()
  };
  if (lead) {
    inv.billTo.name = lead.name || "";
    inv.billTo.address = [lead.address, lead.postcode].filter(Boolean).join("\n");
    inv.billTo.email = lead.email || "";
    inv.billTo.phone = lead.phone || "";
  }
  return inv;
}

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
    survey: { areaM2: "", grassSpec: rates.grasses[0]?.name, accessPct: 0, notes: "" },
    quote: {}, job: {}, payment: {},
    activity: [{ ts: new Date().toISOString(), text: "Lead created" }]
  };
}
