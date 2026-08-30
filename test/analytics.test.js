import { test } from "node:test";
import assert from "node:assert/strict";
import {
  furthestStage, funnel, winRate, byMonth, bySource, sourceKey, avgDaysToClose,
  lostReasons, moneyOwed, overview, invoiceSummary
} from "../src/analytics.js";
import { DEFAULT_RATES } from "../src/model.js";
import { addDays, todayISO } from "../src/util.js";

const state = (leads, invoices = []) => ({
  business: { name: "Test", vat: true },
  rates: structuredClone(DEFAULT_RATES),
  crews: [],
  leads,
  invoices
});
const lead = (patch = {}) => ({
  id: patch.id ?? "x", name: patch.name ?? "A", source: patch.source ?? "",
  stage: patch.stage ?? "enquiry", createdAt: patch.createdAt ?? todayISO(),
  stageAt: patch.stageAt ?? todayISO(), nextAction: null,
  survey: { grassSpec: "Fairway 35mm", ...(patch.survey ?? {}) },
  quote: patch.quote ?? {}, job: patch.job ?? {}, activity: []
});

test("furthestStage sees how far a lost lead actually got", () => {
  assert.equal(furthestStage(lead({ stage: "lost" })), "enquiry");
  assert.equal(furthestStage(lead({ stage: "lost", survey: { areaM2: 30 } })), "surveyed");
  assert.equal(furthestStage(lead({ stage: "lost", quote: { sentAt: "2026-01-01" } })), "quoted");
  assert.equal(furthestStage(lead({ stage: "installed" })), "won");
});

test("funnel counts each step including leads that dropped out later", () => {
  const f = funnel([
    lead({ stage: "enquiry" }),
    lead({ stage: "quoted", quote: { sentAt: "2026-01-01" } }),
    lead({ stage: "won", survey: { areaM2: 40 } }),
    lead({ stage: "lost", quote: { sentAt: "2026-01-01" } }),
    lead({ stage: "lost", survey: { areaM2: 20 } })
  ]);
  assert.deepEqual(f.map((s) => s.count), [5, 4, 3, 1]);
  assert.equal(f[0].fromPrev, 1);
  assert.equal(f[3].fromPrev, 1 / 3); // won from quoted
});

test("win rate is won over closed deals only", () => {
  const wr = winRate([
    lead({ stage: "won" }), lead({ stage: "installed" }),
    lead({ stage: "lost" }), lead({ stage: "quoted" })
  ]);
  assert.deepEqual([wr.won, wr.lost, wr.closed], [2, 1, 3]);
  assert.equal(wr.rate, 2 / 3);
});

test("avgDaysToClose averages created→closed over won jobs", () => {
  const t = todayISO();
  assert.equal(avgDaysToClose([
    lead({ stage: "won", createdAt: addDays(t, -30), stageAt: addDays(t, -10) }),  // 20
    lead({ stage: "installed", createdAt: addDays(t, -50), stageAt: addDays(t, -10) }), // 40
    lead({ stage: "quoted", createdAt: addDays(t, -5) }) // ignored
  ]), 30);
  assert.equal(avgDaysToClose([lead({ stage: "quoted" })]), null);
});

test("byMonth buckets leads created and revenue won into calendar months", () => {
  const rows = byMonth([
    lead({ createdAt: "2026-07-04" }),
    lead({ createdAt: "2026-08-01" }),
    lead({ stage: "won", stageAt: "2026-08-12", createdAt: "2026-06-01", survey: { areaM2: 40 } })
  ], state([]), 6, "2026-08-29");
  assert.equal(rows.length, 6);
  assert.equal(rows.at(-1).label, "Aug");
  assert.equal(rows.at(-1).leads, 1);
  assert.equal(rows.at(-1).won, 1);
  assert.ok(rows.at(-1).revenue > 0);
  assert.equal(rows.at(-2).leads, 1); // July
});

test("sourceKey splits WhatConverts calls out by their real channel", () => {
  assert.equal(sourceKey({ source: "WhatConverts", campaign: "Google Adwords · fake grass yate" }), "Google Adwords");
  assert.equal(sourceKey({ source: "WhatConverts", campaign: "Google Organic" }), "Google Organic");
  assert.equal(sourceKey({ source: "WhatConverts", campaign: "" }), "WhatConverts");
  assert.equal(sourceKey({ source: "Referral" }), "Referral");
  assert.equal(sourceKey({}), "Unknown");
});

test("bySource ranks channels by revenue and reports win rate", () => {
  const rows = bySource([
    lead({ source: "Google Ads", stage: "won", survey: { areaM2: 50 } }),
    lead({ source: "Google Ads", stage: "lost" }),
    lead({ source: "Leaflet", stage: "lost" })
  ], state([]));
  assert.equal(rows[0].source, "Google Ads");
  assert.equal(rows[0].winRate, 0.5);
  assert.equal(rows[1].source, "Leaflet");
  assert.equal(rows[1].winRate, 0);
});

test("lostReasons counts lost deals by reason, biggest first", () => {
  const rows = lostReasons([
    lead({ stage: "lost", ...{ } }), // no reason
    { ...lead({ stage: "lost" }), lostReason: "Price" },
    { ...lead({ stage: "lost" }), lostReason: "Price" },
    { ...lead({ stage: "lost" }), lostReason: "Timing" },
    { ...lead({ stage: "won" }), lostReason: "Price" } // not lost, ignored
  ]);
  assert.equal(rows[0].reason, "Price");
  assert.equal(rows[0].count, 2);
  assert.ok(rows.some((r) => r.reason === "Not recorded" && r.count === 1));
});

test("moneyOwed sums the outstanding balance on won/installed jobs", () => {
  const s = state([
    { ...lead({ stage: "won", survey: { areaM2: 50 } }), payment: {} },
    { ...lead({ stage: "installed", survey: { areaM2: 50 } }), payment: { deposit: 100000, depositPaid: true, balancePaid: true } },
    { ...lead({ stage: "quoted", survey: { areaM2: 50 } }), payment: {} } // not won, ignored
  ]);
  const owed = moneyOwed(s);
  assert.ok(owed > 0);           // the first job is unpaid
  // second job is marked fully paid, so only the first contributes
  const firstTotal = overview(s).wonValue; // won+installed value
  assert.ok(owed < firstTotal);
});

test("invoiceSummary totals VAT this quarter and what's unpaid", () => {
  const t = "2026-08-15"; // Q3 (Jul–Sep)
  const s = state([], [
    { number: 1, date: "2026-07-10", amount: 2400, amountIncVat: true, vat: true, paid: true },   // this quarter
    { number: 2, date: "2026-08-01", amount: 1200, amountIncVat: true, vat: true, paid: false },   // this quarter, unpaid, overdue
    { number: 3, date: "2026-04-02", amount: 6000, amountIncVat: true, vat: true, paid: false }    // last quarter, unpaid
  ]);
  const iv = invoiceSummary(s, t);
  assert.equal(iv.invoicesThisQuarter, 2);
  assert.equal(iv.vatThisQuarter.toFixed(2), (2400 / 6 + 1200 / 6).toFixed(2)); // 1/6 of an inc-VAT figure is the VAT
  assert.equal(iv.invoicesOutstanding.toFixed(2), "7200.00");
  assert.equal(iv.invoicesOverdue.toFixed(2), "7200.00"); // both unpaid are >7 days old
  assert.match(iv.quarterLabel, /Jul.*Sep.*2026/);
});

test("overview pulls the headline numbers together", () => {
  const t = "2026-08-29";
  const s = state([
    lead({ stage: "quoted", quote: { sentAt: addDays(t, -20) }, stageAt: addDays(t, -20), survey: { areaM2: 40 } }), // cold + pipeline
    lead({ stage: "won", stageAt: addDays(t, -3), createdAt: addDays(t, -25), survey: { areaM2: 60 } }),
    lead({ stage: "lost" })
  ]);
  const o = overview(s, t);
  assert.equal(o.totalLeads, 3);
  assert.equal(o.openLeads, 1);
  assert.equal(o.wonCount, 1);
  assert.equal(o.coldQuotes, 1);
  assert.equal(o.winRate.rate, 0.5);
  assert.ok(o.pipelineValue > 0);
  assert.ok(o.weightedPipeline < o.pipelineValue); // discounted by stage odds
  assert.equal(o.wonThisMonthCount, 1);
});
