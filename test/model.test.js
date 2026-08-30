import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteFor, estimateDays, materialsFor, aggregatesFor, sandBagsFor, invoiceTotals, actionState, isCold, setStage, jobsOn, dedupeMatches, paymentState, DEFAULT_RATES } from "../src/model.js";
import { addDays, todayISO } from "../src/util.js";

const rates = structuredClone(DEFAULT_RATES);
const lead = (survey = {}, rest = {}) => ({
  id: "x", stage: "quoted", stageAt: todayISO(), nextAction: null,
  survey: { grassSpec: "Standard 30mm", ...survey }, quote: {}, job: {}, activity: [], ...rest
});

test("prices a job from a per-m² cost stack plus a margin", () => {
  const q = quoteFor(lead({ areaM2: 40 }), rates);
  // 40 m² × £41.42/m² cost, + 40% margin, + 20% VAT
  assert.equal(q.cost.toFixed(2), "1656.80");
  assert.equal(q.margin.toFixed(2), "662.72");
  assert.equal(q.net.toFixed(2), "2319.52");
  assert.equal(q.vat.toFixed(2), "463.90");
  assert.equal(q.total.toFixed(2), "2783.42");
});

test("a per-job crew day rate × days replaces the per-m² labour line", () => {
  const perM2 = quoteFor(lead({ areaM2: 40 }), rates);
  const dayRate = quoteFor(lead({ areaM2: 40, crewDayRate: 500, crewDays: 3 }), rates);
  // labour swaps from 40 × £10.50 (420) to 3 × £500 (1500): cost up £1080
  assert.equal((dayRate.cost - perM2.cost).toFixed(2), "1080.00");
  assert.ok(dayRate.lines.some((l) => l.label === "Crew labour" && /3 days @ £500/.test(l.detail)));
});

test("the customer quote collapses to a single supply-&-install line", () => {
  const q = quoteFor(lead({ areaM2: 40 }), rates);
  assert.equal(q.custLines.length, 1);
  assert.match(q.custLines[0].label, /Supply & installation of 40 m²/);
  assert.equal(q.custLines[0].amt.toFixed(2), q.net.toFixed(2));
});

test("unticking a works item drops its line and its share of margin", () => {
  const withAll = quoteFor(lead({ areaM2: 50 }), rates).net;
  const without = quoteFor(lead({ areaM2: 50, membrane: false, sand: false }), rates).net;
  assert.equal((withAll - without).toFixed(2),
    (50 * (rates.membrane + rates.sand) * (1 + rates.marginPct / 100)).toFixed(2));
});

test("access surcharge applies to the whole job, discount comes off after", () => {
  const base = quoteFor(lead({ areaM2: 40 }), rates).net;
  const surcharged = quoteFor(lead({ areaM2: 40, accessPct: 10 }), rates).net;
  assert.equal(surcharged.toFixed(2), (base * 1.1).toFixed(2));
  const discounted = quoteFor(lead({ areaM2: 40, accessPct: 10, discount: 100 }), rates).net;
  assert.equal(discounted.toFixed(2), (base * 1.1 - 100).toFixed(2));
});

test("VAT is dropped when the business is not registered", () => {
  const q = quoteFor(lead({ areaM2: 30 }), rates, false);
  assert.equal(q.vat, 0);
  assert.equal(q.total, q.net);
});

test("an empty survey prices at zero rather than throwing", () => {
  const q = quoteFor(lead(), rates);
  assert.equal(q.total, 0);
  assert.equal(q.area, 0);
});

test("job length comes from crew output, rounded up", () => {
  assert.equal(estimateDays(40, rates), 1);
  assert.equal(estimateDays(41, rates), 2);
  assert.equal(estimateDays(200, rates), 5);
  assert.equal(estimateDays(0, rates), 1); // never zero days
});

test("aggregate tonnage comes from area × depth × density", () => {
  const a = aggregatesFor(40, rates); // 75mm type 1, 25mm dust
  assert.equal(a.type1.toFixed(1), "6.0");      // 40 × 0.075 × 2.0
  assert.equal(a.stoneDust.toFixed(2), "1.75"); // 40 × 0.025 × 1.75
  assert.ok(a.muckaway > a.type1);              // spoil = build-up depth + turf strip
  assert.equal(aggregatesFor(0, rates).type1, 0);
  // deeper sub-base ⇒ more tonnes
  assert.ok(aggregatesFor(40, { ...rates, type1Depth: 150 }).type1 > a.type1);
  // muck-away follows its own dig-depth setting
  assert.equal(aggregatesFor(40, { ...rates, muckawayDepth: 200 }).digDepthMm, 200);
  assert.ok(aggregatesFor(40, { ...rates, muckawayDepth: 200 }).muckaway > a.muckaway);
});

test("invoiceTotals backs VAT out of an inc-VAT figure, or adds it to an ex-VAT one", () => {
  const inc = invoiceTotals({ amount: 2750, amountIncVat: true, vat: true }, 20);
  assert.equal(inc.net.toFixed(2), "2291.67");
  assert.equal(inc.vat.toFixed(2), "458.33");
  assert.equal(inc.total.toFixed(2), "2750.00");
  const ex = invoiceTotals({ amount: 2000, amountIncVat: false, vat: true }, 20);
  assert.equal(ex.total.toFixed(2), "2400.00");
  const none = invoiceTotals({ amount: 2000, vat: false }, 20);
  assert.deepEqual([none.net, none.vat, none.total], [2000, 0, 2000]);
});

test("sand is one 25kg bag per 4 m², rounded up", () => {
  assert.equal(sandBagsFor(40), 10);
  assert.equal(sandBagsFor(41), 11);
  assert.equal(sandBagsFor(0), 0);
});

test("materials list scales with the job and follows the works toggles", () => {
  const items = materialsFor(lead({ areaM2: 50 }), rates);
  const labels = items.map((i) => i.label);
  assert.ok(labels.some((l) => l.startsWith("Type 1 sub-base")));
  assert.ok(labels.includes("Edging"));
  assert.ok(labels.includes("Muck-away"));
  assert.equal(items.find((i) => i.label === "Standard 30mm").qty, "55.0 m²");

  const trimmed = materialsFor(lead({ areaM2: 50, edging: false, muckaway: false }), rates).map((i) => i.label);
  assert.ok(!trimmed.includes("Edging"));
  assert.ok(!trimmed.includes("Muck-away"));
});

test("follow-up state reads overdue, today and upcoming", () => {
  const t = todayISO();
  assert.equal(actionState({ nextAction: addDays(t, -3) }, t).kind, "overdue");
  assert.equal(actionState({ nextAction: addDays(t, -3) }, t).label, "3 days overdue");
  assert.equal(actionState({ nextAction: addDays(t, -1) }, t).label, "1 day overdue");
  assert.equal(actionState({ nextAction: t }, t).kind, "today");
  assert.equal(actionState({ nextAction: addDays(t, 4) }, t).kind, "soon");
  assert.equal(actionState({ nextAction: addDays(t, 30) }, t).kind, "later");
  assert.equal(actionState({ nextAction: null }, t).kind, "none");
});

test("a quote goes cold after a fortnight, and only while quoted", () => {
  const t = todayISO();
  assert.equal(isCold({ stage: "quoted", quote: { sentAt: addDays(t, -13) } }, t), false);
  assert.equal(isCold({ stage: "quoted", quote: { sentAt: addDays(t, -14) } }, t), true);
  assert.equal(isCold({ stage: "won", quote: { sentAt: addDays(t, -40) } }, t), false);
});

test("moving to Quoted stamps the send date and sets a chase", () => {
  const t = todayISO();
  const l = lead({}, { stage: "surveyed" });
  setStage(l, "quoted", t);
  assert.equal(l.quote.sentAt, t);
  assert.equal(l.nextAction, addDays(t, 4));
  assert.match(l.activity[0].text, /Surveyed → Quoted/);
});

test("winning a job clears the follow-up, installing sets an aftercare call", () => {
  const t = todayISO();
  const won = lead({}, { nextAction: t });
  setStage(won, "won", t);
  assert.equal(won.nextAction, null);
  const installed = lead({}, { stage: "won" });
  setStage(installed, "installed", t);
  assert.equal(installed.nextAction, addDays(t, 14));
});

test("dedupeMatches flags same phone or same postcode+name, never itself", () => {
  const all = [
    { id: "a", name: "Jo Bloggs", phone: "07700 900 123", postcode: "BS37 5DL" },
    { id: "b", name: "Someone Else", phone: "0117 111 2222", postcode: "BS1 1AA" },
    { id: "c", name: "Jo Bloggs", phone: "", postcode: "bs37 5dl" }
  ];
  assert.deepEqual(dedupeMatches({ id: "x", phone: "07700900123" }, all).map((l) => l.id), ["a"]);
  assert.deepEqual(dedupeMatches({ id: "x", name: "jo bloggs", postcode: "BS375DL" }, all).map((l) => l.id).sort(), ["a", "c"]);
  assert.deepEqual(dedupeMatches({ id: "a", phone: "07700900123", name: "Jo Bloggs", postcode: "BS37 5DL" }, all).map((l) => l.id), ["c"]);
  assert.deepEqual(dedupeMatches({ id: "x", phone: "123" }, all), []); // too short to match
});

test("paymentState tracks deposit, balance and what's outstanding", () => {
  const total = 4000;
  assert.equal(paymentState({ payment: {} }, total).outstanding, 4000);
  assert.equal(paymentState({ payment: { deposit: 1000, depositPaid: true } }, total).outstanding, 3000);
  const done = paymentState({ payment: { deposit: 1000, depositPaid: true, balancePaid: true } }, total);
  assert.equal(done.outstanding, 0);
  assert.equal(done.settled, true);
  assert.equal(paymentState({ payment: { deposit: 9999 } }, total).balance, 0); // deposit capped at total
});

test("two jobs on one crew on one day is a clash", () => {
  const t = todayISO();
  const leads = [
    { id: "a", job: { crewId: "c1", startDate: t, days: 3 } },
    { id: "b", job: { crewId: "c1", startDate: addDays(t, 2), days: 1 } },
    { id: "c", job: { crewId: "c2", startDate: t, days: 5 } }
  ];
  assert.equal(jobsOn(leads, "c1", t).length, 1);
  assert.equal(jobsOn(leads, "c1", addDays(t, 2)).length, 2, "overlap on day 3");
  assert.equal(jobsOn(leads, "c1", addDays(t, 3)).length, 0, "3-day job has finished");
  assert.equal(jobsOn(leads, "c2", addDays(t, 4)).length, 1);
});
