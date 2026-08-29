// The home screen: what needs doing now, and what is landing this week.
import { esc, money, num, todayISO, dayDiff, fmtDate, fmtDateLong } from "../util.js";
import { quoteFor, actionState, isCold, stage } from "../model.js";
import { icon } from "../icons.js";

const tile = (value, key, meta, cls = "") => `
  <div class="tile ${cls}"><span class="stripe"></span>
    <div class="k">${esc(key)}</div><div class="v">${esc(String(value))}</div><div class="m">${esc(meta)}</div>
  </div>`;

function chaseRow(lead, total) {
  const a = actionState(lead);
  const tone = a.tone === "crit" ? "crit" : a.tone === "warn" ? "warn" : "";
  return `<div class="qrow" data-open="${lead.id}">
    <span class="qmark ${tone}"></span>
    <div class="qmain">
      <div class="qname">${esc(lead.name || "Unnamed enquiry")}</div>
      <div class="qmeta">${esc(lead.nextNote || stage(lead.stage).label)}</div>
    </div>
    <div class="qright"><span class="qval">${money(total)}</span>
      <span class="pill ${a.tone}"><span class="pdot"></span>${esc(a.kind === "soon" ? "Due " + fmtDate(lead.nextAction) : a.label)}</span>
    </div></div>`;
}

export function renderToday(ctx) {
  const { state } = ctx;
  const t = todayISO();
  const value = (l) => quoteFor(l, state.rates, state.business.vat).total;

  if (!state.leads.length) {
    return `<div class="card"><div class="empty" style="padding:56px 20px">
      <strong>Nothing in here yet</strong>
      Add your first enquiry to get going.
      <div style="margin-top:18px;display:flex;gap:9px;justify-content:center;flex-wrap:wrap">
        <button class="btn primary" data-act="new">${icon("plus")}New enquiry</button>
      </div></div></div>`;
  }

  const live = state.leads.filter((l) => l.stage !== "lost");
  const byDate = (a, b) => (a.nextAction ?? "") < (b.nextAction ?? "") ? -1 : 1;
  const due = live.filter((l) => ["overdue", "today"].includes(actionState(l).kind)).sort(byDate);
  const soon = live.filter((l) => actionState(l).kind === "soon").sort(byDate);
  const overdue = due.filter((l) => actionState(l).kind === "overdue").length;
  const cold = live.filter((l) => isCold(l));
  const quoted = live.filter((l) => l.stage === "quoted");
  const won = state.leads.filter((l) => ["won", "installed"].includes(l.stage) && l.stageAt?.slice(0, 7) === t.slice(0, 7));
  const installs = state.leads
    .filter((l) => l.job?.startDate && l.job.status !== "complete" && dayDiff(t, l.job.startDate) >= -2 && dayDiff(t, l.job.startDate) <= 9)
    .sort((a, b) => (a.job.startDate < b.job.startDate ? -1 : 1));

  const sum = (list) => list.reduce((s, l) => s + value(l), 0);

  const installRow = (l) => {
    const cr = state.crews.find((c) => c.id === l.job.crewId);
    const d = dayDiff(t, l.job.startDate);
    const when = d === 0 ? "Today" : d === 1 ? "Tomorrow" : d < 0 ? `${fmtDate(l.job.startDate)} (running)` : fmtDateLong(l.job.startDate);
    return `<div class="qrow" data-open="${l.id}">
      <span class="qmark ${d === 0 ? "good" : ""}"></span>
      <div class="qmain"><div class="qname">${esc(l.name || "Unnamed")}</div>
        <div class="qmeta">${esc(when)} · ${esc(cr?.name ?? "Unassigned")} · ${l.job.days || 1} day${(l.job.days || 1) > 1 ? "s" : ""} · ${esc(l.postcode || l.address || "")}</div></div>
      <div class="qright"><span class="qval">${num(l.survey?.areaM2, 0)} m²</span></div></div>`;
  };

  return `
    ${cold.length ? `<div class="banner warn">${icon("alert")}<div><strong>${cold.length} quote${cold.length > 1 ? "s have" : " has"} gone cold.</strong> No movement in a fortnight — worth one last call before writing them off.</div></div>` : ""}
    <div class="tiles">
      ${tile(due.length, "Needs action", `${overdue} overdue · ${due.length - overdue} due today`, overdue ? "alert" : "")}
      ${tile(quoted.length, "Quotes out", `${money(sum(quoted))} in play`)}
      ${tile(installs.filter((l) => dayDiff(t, l.job.startDate) >= 0 && dayDiff(t, l.job.startDate) <= 7).length, "Installs next 7 days", `${installs.length} on the board`)}
      ${tile(won.length, "Won this month", money(sum(won)))}
    </div>
    <div class="two-col">
      <div style="display:flex;flex-direction:column;gap:16px">
        <section class="card"><div class="card-h"><h3>Chase list</h3><span class="n">${due.length}</span></div>
          <div class="card-b flush">${due.length ? `<div class="queue">${due.map((l) => chaseRow(l, value(l))).join("")}</div>` : `<div class="empty"><strong>You are straight</strong>Nothing overdue and nothing due today.</div>`}</div></section>
        <section class="card"><div class="card-h"><h3>Coming up this week</h3><span class="n">${soon.length}</span></div>
          <div class="card-b flush">${soon.length ? `<div class="queue">${soon.slice(0, 6).map((l) => chaseRow(l, value(l))).join("")}</div>` : `<div class="empty">Nothing scheduled in the next week.</div>`}</div></section>
      </div>
      <section class="card"><div class="card-h"><h3>Installs</h3><span class="n">next 7 days</span></div>
        <div class="card-b flush">${installs.length ? `<div class="queue">${installs.map(installRow).join("")}</div>` : `<div class="empty">No installs booked in the next week.</div>`}</div></section>
    </div>`;
}
