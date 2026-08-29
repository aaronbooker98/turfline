import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteFor, estimateDays, materialsFor, actionState, isCold, setStage, jobsOn, DEFAULT_RATES } from "../src/model.js";
import { addDays, todayISO } from "../src/util.js";

const rates = structuredClone(DEFAULT_RATES);
const lead = (survey = {}, rest = {}) => ({
  id: "x", stage: "quoted", stageAt: todayISO(), nextAction: null,
  survey: { grassSpec: "Fairway 35mm", ...survey }, quote: {}, job: {}, activity: [], ...rest
});

test("prices a job from area, waste, materials and labour", () => {
  const q = quoteFor(lead({ areaM2: 64, edgingM: 32, skip: true }), rates);
  // 64 m² + 10% waste = 70.4 m² of grass at £17.90
  assert.equal(q.billable.toFixed(1), "70.4");
  assert.equal(q.net.toFixed(2), "3827.36");
  assert.equal(q.vat.toFixed(2), "765.47");
  assert.equal(q.total.toFixed(2), "4592.83");
});

test("skips membrane and sand when the survey says so", () => {
  const withAll = quoteFor(lead({ areaM2: 50 }), rates).net;
  const without = quoteFor(lead({ areaM2: 50, membrane: false, sand: false }), rates).net;
  assert.equal((withAll - without).toFixed(2), (50 * (rates.membrane + rates.sand)).toFixed(2));
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
  assert.equal(estimateDays(35, rates), 1);
  assert.equal(estimateDays(36, rates), 2);
  assert.equal(estimateDays(180, rates), 6);
  assert.equal(estimateDays(0, rates), 1); // never zero days
});

test("materials list scales with the job", () => {
  const items = materialsFor(lead({ areaM2: 50, edgingM: 20, skip: true }), rates);
  const labels = items.map((i) => i.label);
  assert.ok(labels.includes("Sub-base aggregate"));
  assert.ok(labels.includes("Timber edging"));
  assert.ok(labels.includes("Skip"));
  assert.equal(items.find((i) => i.label === "Fairway 35mm").qty, "55.0 m²");
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
