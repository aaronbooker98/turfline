// Aggregations across every record, for the Analytics screen.
// No DOM and no module-level state: everything here is unit tested in
// test/analytics.test.js and can be run without a browser.
import { num, todayISO, dayDiff, parseISO } from "./util.js";
import { quoteFor, isCold } from "./model.js";

export const WON_STAGES = ["won", "installed"];
export const OPEN_STAGES = ["enquiry", "survey", "surveyed", "quoted"];

// Rough odds a live lead at each stage turns into a booked job. Used to weight
// the pipeline so one £8k enquiry doesn't read the same as a signed £8k job.
export const STAGE_ODDS = {
  enquiry: 0.1, survey: 0.3, surveyed: 0.45, quoted: 0.65, won: 1, installed: 1, lost: 0
};

export const leadValue = (lead, state) =>
  quoteFor(lead, state.rates, state.business.vat).total;

/** How far a lead actually got, even once it's been marked lost. */
export function furthestStage(lead) {
  if (WON_STAGES.includes(lead.stage)) return "won";
  if (lead.stage === "lost") {
    if (lead.quote?.sentAt) return "quoted";
    if (num(lead.survey?.areaM2) > 0) return "surveyed";
    return "enquiry";
  }
  return lead.stage; // enquiry | survey | surveyed | quoted
}

const RANK = { enquiry: 0, survey: 1, surveyed: 2, quoted: 3, won: 4 };
const reached = (lead, stageId) => RANK[furthestStage(lead)] >= RANK[stageId];

/** Enquiry → Surveyed → Quoted → Won, with drop-off between each step. */
export function funnel(leads) {
  const steps = [
    { id: "enquiry", label: "Enquiries", count: leads.length },
    { id: "surveyed", label: "Surveyed", count: leads.filter((l) => reached(l, "surveyed")).length },
    { id: "quoted", label: "Quoted", count: leads.filter((l) => reached(l, "quoted")).length },
    { id: "won", label: "Won", count: leads.filter((l) => reached(l, "won")).length }
  ];
  const top = steps[0].count || 1;
  return steps.map((s, i) => ({
    ...s,
    ofStart: s.count / top,
    fromPrev: i === 0 ? 1 : steps[i - 1].count ? s.count / steps[i - 1].count : 0
  }));
}

/** Won / (won + lost) over deals that have actually closed. */
export function winRate(leads) {
  const won = leads.filter((l) => WON_STAGES.includes(l.stage)).length;
  const lost = leads.filter((l) => l.stage === "lost").length;
  const closed = won + lost;
  return { won, lost, closed, rate: closed ? won / closed : 0 };
}

const monthKey = (iso) => (iso ? String(iso).slice(0, 7) : null);

/** Last `months` calendar months, oldest first: leads taken, jobs won, revenue. */
export function byMonth(leads, state, months = 6, today = todayISO()) {
  const now = parseISO(today);
  const keys = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-GB", { month: "short" })
    });
  }
  const rows = keys.map((k) => ({ ...k, leads: 0, won: 0, revenue: 0 }));
  const at = (key) => rows.find((r) => r.key === key);
  for (const l of leads) {
    const created = at(monthKey(l.createdAt));
    if (created) created.leads++;
    if (WON_STAGES.includes(l.stage)) {
      const closed = at(monthKey(l.stageAt));
      if (closed) { closed.won++; closed.revenue += leadValue(l, state); }
    }
  }
  return rows;
}

/** Grouping key for the source breakdown. Calls captured by WhatConverts carry
 *  "WhatConverts" as the source and the real channel ("Google Adwords ·
 *  keyword") in the campaign — split those out so the breakdown is useful. */
export function sourceKey(lead) {
  if ((lead.source || "").toLowerCase() === "whatconverts" && lead.campaign)
    return lead.campaign.split(" · ")[0].trim() || lead.source;
  return lead.source || "Unknown";
}

/** Per lead source: volume, conversion and money won. Best sources first. */
export function bySource(leads, state) {
  const map = new Map();
  for (const l of leads) {
    const name = sourceKey(l);
    const row = map.get(name) ?? { source: name, leads: 0, won: 0, lost: 0, revenue: 0, pipeline: 0 };
    row.leads++;
    if (WON_STAGES.includes(l.stage)) { row.won++; row.revenue += leadValue(l, state); }
    else if (l.stage === "lost") row.lost++;
    else row.pipeline += leadValue(l, state);
    map.set(name, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, winRate: r.won + r.lost ? r.won / (r.won + r.lost) : 0 }))
    .sort((a, b) => b.revenue - a.revenue || b.leads - a.leads);
}

/** Mean calendar days from a lead being created to it closing won. */
export function avgDaysToClose(leads) {
  const spans = leads
    .filter((l) => WON_STAGES.includes(l.stage) && l.createdAt && l.stageAt)
    .map((l) => dayDiff(l.createdAt, l.stageAt))
    .filter((n) => n >= 0);
  return spans.length ? Math.round(spans.reduce((a, b) => a + b, 0) / spans.length) : null;
}

/** One object with everything the Analytics view puts on screen. */
export function overview(state, today = todayISO()) {
  const leads = state.leads;
  const open = leads.filter((l) => OPEN_STAGES.includes(l.stage));
  const wonLeads = leads.filter((l) => WON_STAGES.includes(l.stage));
  const sum = (list) => list.reduce((s, l) => s + leadValue(l, state), 0);

  const pipelineValue = sum(open);
  const weightedPipeline = open.reduce((s, l) => s + leadValue(l, state) * (STAGE_ODDS[l.stage] ?? 0), 0);
  const wonValue = sum(wonLeads);
  const thisMonth = today.slice(0, 7);
  const wonThisMonth = wonLeads.filter((l) => monthKey(l.stageAt) === thisMonth);
  const wr = winRate(leads);
  const cold = leads.filter((l) => isCold(l, today));

  return {
    totalLeads: leads.length,
    openLeads: open.length,
    pipelineValue,
    weightedPipeline,
    wonCount: wonLeads.length,
    wonValue,
    wonThisMonthCount: wonThisMonth.length,
    wonThisMonthValue: sum(wonThisMonth),
    avgDealSize: wonLeads.length ? wonValue / wonLeads.length : 0,
    winRate: wr,
    avgDaysToClose: avgDaysToClose(leads),
    coldQuotes: cold.length,
    coldValue: sum(cold),
    funnel: funnel(leads),
    bySource: bySource(leads, state),
    byMonth: byMonth(leads, state, 6, today)
  };
}
