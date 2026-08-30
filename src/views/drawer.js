// The record editor: one enquiry from first call to aftercare.
import { esc, num, money, money2, fmtDate, dayDiff, todayISO } from "../util.js";
import { quoteFor, actionState, isCold, stage, STAGES, CHANNELS, LOST_REASONS, dedupeMatches, paymentState, WORKS, workIsOn } from "../model.js";
import { icon } from "../icons.js";

/** The quote breakdown, also re-rendered on its own while typing. */
export function quoteBreakdown(lead, state) {
  const q = quoteFor(lead, state.rates, state.business.vat);
  if (!(q.area > 0)) return `<div class="empty" style="padding:18px">Enter an area to build the quote.</div>`;
  const row = (l) => `<div class="qline"><span>${esc(l.label)}${l.detail ? ` <span class="det">${esc(l.detail)}</span>` : ""}</span><span>${money2(l.amt)}</span></div>`;
  return [
    ...q.lines.filter((l) => l.grp === "cost").map(row),
    `<div class="qline sub"><span>Cost</span><span>${money2(q.cost)}</span></div>`,
    ...q.lines.filter((l) => l.grp === "after").map(row),
    `<div class="qline sub"><span>Net${q.vatPct ? " (ex VAT)" : ""}</span><span>${money2(q.net)}</span></div>`,
    q.vatPct ? `<div class="qline muted"><span>VAT @ ${q.vatPct}%</span><span>${money2(q.vat)}</span></div>` : "",
    `<div class="qline tot"><span>Total</span><span>${money2(q.total)}</span></div>`,
    `<div class="qline muted"><span>${q.billable.toFixed(1)} m² of grass to order · about ${q.days} crew day${q.days > 1 ? "s" : ""}</span><span>${money2(q.area ? q.total / q.area : 0)}/m²</span></div>`
  ].join("");
}

/** Deposit / balance block. Shown for jobs that are won or beyond. */
function paymentSection(lead, total) {
  if (!["won", "installed"].includes(lead.stage) || !(total > 0)) return "";
  const pay = paymentState(lead, total);
  const row = (label, amt, key, on) => `<label class="payrow">
    <span><input type="checkbox" data-f="payment.${key}"${on ? " checked" : ""}> ${esc(label)}</span>
    <span class="num">${money2(amt)}</span></label>`;
  return `<div class="sect"><h4>Payment</h4>
    <div class="grid2">
      <div class="field"><label class="lbl">Deposit £</label>
        <input class="inp num" type="number" step="1" data-f="payment.deposit" value="${esc(lead.payment?.deposit ?? "")}" placeholder="0"></div>
      <div class="field"><label class="lbl">Outstanding</label>
        <div style="padding-top:7px"><span class="pill ${pay.settled ? "good" : pay.outstanding ? "warn" : "neutral"}">
          <span class="pdot"></span>${pay.settled ? "Paid in full" : money2(pay.outstanding) + " due"}</span></div></div>
    </div>
    ${row("Deposit received", pay.deposit, "depositPaid", pay.depositPaid)}
    ${row("Balance received", pay.balance, "balancePaid", pay.balancePaid)}
  </div>`;
}

export function renderDrawer(ctx, lead) {
  const { state, ui } = ctx;
  const ro = ui.readOnly;
  const q = quoteFor(lead, state.rates, state.business.vat);
  const a = actionState(lead);
  const dis = ro ? " disabled" : "";

  const field = (label, key, value, type = "text", attrs = "") => `
    <div class="field"><label class="lbl">${esc(label)}</label>
      <input class="inp${type === "number" ? " num" : ""}" type="${type}" data-f="${key}" value="${esc(value ?? "")}" ${attrs}${dis}></div>`;

  const dupes = dedupeMatches(lead, state.leads);

  const body = `
    <div class="stagebar">${STAGES.map((s) =>
      `<button class="stagebtn" data-stage="${s.id}" aria-pressed="${lead.stage === s.id}"${dis}>${esc(s.label)}</button>`).join("")}</div>

    ${lead.stage === "lost" ? `<div class="field" style="margin-bottom:14px">
      <label class="lbl">Why we lost it</label>
      <select class="inp" data-f="lostReason"${dis}>
        <option value="">— pick a reason —</option>
        ${LOST_REASONS.map((r) => `<option${lead.lostReason === r ? " selected" : ""}>${esc(r)}</option>`).join("")}
      </select></div>` : ""}

    ${dupes.length ? `<div class="banner info">${icon("alert")}<div>
      Possible duplicate of <strong>${esc(dupes[0].name || "another record")}</strong>${dupes.length > 1 ? ` (+${dupes.length - 1} more)` : ""}.
      <a href="#" data-open="${dupes[0].id}" style="color:inherit;font-weight:600">Open it</a></div></div>` : ""}

    ${isCold(lead) ? `<div class="banner warn">${icon("alert")}<div>Quoted ${Math.abs(dayDiff(lead.quote?.sentAt || lead.stageAt, todayISO()))} days ago with no movement. Call it or close it.</div></div>` : ""}

    <div class="sect"><h4>Next action</h4>
      <div class="grid2">
        <div class="field"><label class="lbl">Date</label><input class="inp" type="date" data-f="nextAction" value="${esc(lead.nextAction ?? "")}"${dis}></div>
        <div class="field"><label class="lbl">Status</label><div style="padding-top:7px"><span class="pill ${a.tone}"><span class="pdot"></span>${esc(a.kind === "soon" ? "Due " + fmtDate(lead.nextAction) : a.label)}</span></div></div>
      </div>
      <div class="field"><label class="lbl">What needs doing</label>
        <input class="inp" data-f="nextNote" value="${esc(lead.nextNote ?? "")}" placeholder="Call about the quote…"${dis}></div>
      ${ro ? "" : `<div style="display:flex;gap:7px;flex-wrap:wrap">
        <button class="btn sm" data-snooze="1">+1 day</button>
        <button class="btn sm" data-snooze="3">+3 days</button>
        <button class="btn sm" data-snooze="7">+1 week</button>
        <button class="btn sm" data-act="done-action">${icon("check")}Done — log it</button></div>`}
    </div>

    <div class="sect"><h4>Contact</h4>
      <div class="grid2">${field("Name", "name", lead.name)}${field("Phone", "phone", lead.phone)}</div>
      ${field("Email", "email", lead.email, "email")}
      <div class="grid2">${field("Address", "address", lead.address)}${field("Postcode", "postcode", lead.postcode)}</div>
      <div class="grid2">${field("Lead source", "source", lead.source, "text", 'placeholder="Google Ads, referral…"')}${field("Campaign / keyword", "campaign", lead.campaign)}</div>
      <div class="field"><label class="lbl">How it came in</label>
        <select class="inp" data-f="channel"${dis}>${CHANNELS.map((c) =>
          `<option value="${c.id}"${(lead.channel || "manual") === c.id ? " selected" : ""}>${esc(c.label)}</option>`).join("")}</select></div>
    </div>

    <div class="sect"><h4>Survey</h4>
      <div class="grid2">
        ${field("Area (m²)", "survey.areaM2", lead.survey.areaM2, "number", 'step="0.5" placeholder="0"')}
        <div class="field"><label class="lbl">Grass</label>
          <select class="inp" data-f="survey.grassSpec"${dis}>${state.rates.grasses.map((g) =>
            `<option${g.name === lead.survey.grassSpec ? " selected" : ""}>${esc(g.name)}</option>`).join("")}</select></div>
      </div>
      ${field("Difficult access surcharge %", "survey.accessPct", lead.survey.accessPct ?? 0, "number", 'step="1"')}
      <div class="lbl" style="margin-top:6px">Works included (untick anything this job doesn't need)</div>
      <div class="checks">
        ${WORKS.map(([key, label]) =>
          `<label><input type="checkbox" data-f="survey.${key}"${workIsOn(lead.survey, key) ? " checked" : ""}${dis}> ${esc(label)}</label>`).join("")}
      </div>
      <div class="grid2">${field("Extra works label", "survey.extraLabel", lead.survey.extraLabel)}${field("Extra works £", "survey.extraCost", lead.survey.extraCost, "number", 'step="1"')}</div>
      ${field("Discount £", "survey.discount", lead.survey.discount, "number", 'step="1"')}
      <div class="field"><label class="lbl">Site notes</label><textarea class="inp" data-f="survey.notes"${dis}>${esc(lead.survey.notes ?? "")}</textarea></div>
    </div>

    <div class="sect"><h4>Quote</h4>
      <div class="quote-out">${quoteBreakdown(lead, state)}</div>
      ${ro || !(q.total > 0) ? "" : `<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn sm" data-act="print-quote" data-id="${lead.id}">${icon("jobs")}Print / save quote</button>
        ${lead.quote?.ref ? `<span style="font-size:12px;color:var(--muted)">Ref ${esc(lead.quote.ref)}</span>` : ""}</div>`}
    </div>

    ${ro ? "" : paymentSection(lead, q.total)}

    <div class="sect"><h4>Installation</h4>
      <div class="grid3">
        <div class="field"><label class="lbl">Crew</label>
          <select class="inp" data-f="job.crewId"${dis}><option value="">Unassigned</option>${state.crews.map((c) =>
            `<option value="${c.id}"${lead.job?.crewId === c.id ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
        <div class="field"><label class="lbl">Start date</label>
          <input class="inp" type="date" data-f="job.startDate" value="${esc(lead.job?.startDate ?? "")}"${dis}></div>
        ${field("Days on site", "job.days", lead.job?.days ?? q.days, "number", 'step="1" min="1"')}
      </div>
      ${ro ? "" : lead.job?.status === "complete"
        ? `<span class="pill good"><span class="pdot"></span>Completed ${fmtDate(lead.job.completedAt)}</span>`
        : `<button class="btn sm" data-act="complete" data-id="${lead.id}">${icon("check")}Mark complete</button>`}
    </div>

    <div class="sect"><h4>History</h4>
      ${(lead.activity ?? []).slice(0, 14).map((entry) => `<div class="act">
        <span class="t">${new Date(entry.ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
        <span>${esc(entry.text)}</span></div>`).join("")}
    </div>`;

  return `<div class="scrim" data-act="close"></div>
    <aside class="drawer" role="dialog" aria-label="Enquiry record">
      <div class="drawer-h">
        <div style="flex:1;min-width:0">
          <h2>${esc(lead.name || "New enquiry")}</h2>
          <div class="s">${esc(stage(lead.stage).label)} · ${esc(lead.postcode || lead.address || "no address")} · ${money(q.total)}</div>
        </div>
        <button class="btn ghost sm" data-act="close" aria-label="Close">${icon("x")}</button>
      </div>
      <div class="drawer-b">${body}</div>
      <div class="drawer-f">${ro
        ? `<span style="font-size:12.5px;color:var(--muted)">View only</span>`
        : `<button class="btn danger sm" data-act="del-lead" data-id="${lead.id}">Delete</button>
           <div style="margin-left:auto"></div>
           <button class="btn primary" data-act="close">Done</button>`}</div>
    </aside>`;
}
