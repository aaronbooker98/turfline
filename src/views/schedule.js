// Crew schedule — month calendar or week grid, with clash detection.
import { esc, addDays, mondayOf, parseISO, todayISO, dayDiff, fmtDate } from "../util.js";
import { quoteFor, jobsOn } from "../model.js";
import { icon } from "../icons.js";

export function renderSchedule(ctx) {
  const { ui } = ctx;
  const view = ui.schedView === "month" ? "month" : "week";
  const toggle = `<div class="segbtns">
    <button class="segbtn" data-act="sched-view" data-view="week" aria-pressed="${view === "week"}">Week</button>
    <button class="segbtn" data-act="sched-view" data-view="month" aria-pressed="${view === "month"}">Month</button>
  </div>`;
  return (view === "month" ? renderMonth(ctx, toggle) : renderWeek(ctx, toggle)) + unbookedCard(ctx);
}

/* ---------------- month calendar ---------------- */

function jobsSpanning(leads, dayISO) {
  return leads.filter((l) => {
    if (!l.job?.startDate) return false;
    const off = dayDiff(l.job.startDate, dayISO);
    return off >= 0 && off < (l.job.days || 1);
  });
}

function renderMonth(ctx, toggle) {
  const { state, ui } = ctx;
  const today = todayISO();
  const monthStart = ui.monthStart || `${today.slice(0, 7)}-01`;
  const mDate = parseISO(monthStart);
  const gridStart = mondayOf(monthStart);
  const daysInMonth = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0).getDate();
  const lead = dayDiff(gridStart, monthStart);
  const weeks = Math.ceil((lead + daysInMonth) / 7);
  const crew = (id) => state.crews.find((c) => c.id === id);

  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    .map((d) => `<div class="cal-dow">${d}</div>`).join("");

  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(gridStart, i);
    const dt = parseISO(d);
    const inMonth = dt.getMonth() === mDate.getMonth();
    const wknd = dt.getDay() === 0 || dt.getDay() === 6;
    const jobs = jobsSpanning(state.leads, d);
    const perCrew = new Map();
    for (const j of jobs) perCrew.set(j.job.crewId || "", (perCrew.get(j.job.crewId || "") || 0) + 1);

    const chips = jobs.slice(0, 4).map((l) => {
      const c = crew(l.job.crewId);
      const clash = (perCrew.get(l.job.crewId || "") || 0) > 1;
      const total = l.job.days || 1;
      const dayNo = dayDiff(l.job.startDate, d) + 1;
      return `<div class="cal-job${clash ? " clash" : ""}${l.job.status === "complete" ? " done" : ""}"
        data-open="${l.id}"${clash ? "" : ` style="border-left-color:${esc(c?.colour || "var(--line)")}"`}>
        <span class="cj-n">${esc(l.name || "Job")}</span>${total > 1 ? `<span class="cj-d">d${dayNo}/${total}</span>` : ""}</div>`;
    }).join("");
    const more = jobs.length > 4 ? `<div class="cal-more">+${jobs.length - 4} more</div>` : "";

    cells.push(`<div class="cal-cell${inMonth ? "" : " out"}${wknd ? " wknd" : ""}${d === today ? " today" : ""}">
      <div class="cal-num">${dt.getDate()}</div>${chips}${more}</div>`);
  }

  const label = mDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return `
    <div class="weeknav">
      ${toggle}
      <button class="btn sm" data-act="month-prev" aria-label="Previous month">${icon("back")}</button>
      <button class="btn sm" data-act="month-next" aria-label="Next month">${icon("chev")}</button>
      <span class="weeklabel">${esc(label)}</span>
      <button class="btn sm ghost" data-act="month-today">This month</button>
    </div>
    <div class="calwrap"><div class="cal">
      <div class="cal-head">${dow}</div>
      <div class="cal-grid" style="grid-template-rows:repeat(${weeks},minmax(96px,1fr))">${cells.join("")}</div>
    </div></div>`;
}

/* ---------------- week grid (crew × day) ---------------- */

function renderWeek(ctx, toggle) {
  const { state, ui } = ctx;
  const today = todayISO();
  const days = Array.from({ length: 7 }, (_, i) => addDays(ui.weekStart, i));
  const cellClass = (d) => {
    const wd = parseISO(d).getDay();
    return `${d === today ? " today" : ""}${wd === 0 || wd === 6 ? " wknd" : ""}`;
  };

  const head = `<div class="srow head">
    <div class="scell"><span class="sday">Crew</span></div>
    ${days.map((d) => {
      const dt = parseISO(d);
      return `<div class="scell${cellClass(d)}">
        <div class="sday">${dt.toLocaleDateString("en-GB", { weekday: "short" })}</div>
        <div class="sdate">${dt.getDate()} ${dt.toLocaleDateString("en-GB", { month: "short" })}</div></div>`;
    }).join("")}
  </div>`;

  const rows = state.crews.map((crew) => {
    const cells = days.map((d) => {
      const jobs = jobsOn(state.leads, crew.id, d);
      const clash = jobs.length > 1;
      return `<div class="scell${cellClass(d)}">${jobs.map((l) => {
        const dayNo = dayDiff(l.job.startDate, d) + 1;
        const total = l.job.days || 1;
        return `<div class="jblock${clash ? " clash" : ""}${l.job.status === "complete" ? " done" : ""}" data-open="${l.id}"${clash ? "" : ` style="border-left-color:${esc(crew.colour)}"`}>
          <div class="jn">${esc(l.name || "Job")}</div>
          <div class="jm">${esc(l.postcode || "")} · day ${dayNo}/${total}</div></div>`;
      }).join("")}</div>`;
    }).join("");
    return `<div class="srow"><div class="scell crewcell"><span class="crewdot" style="background:${esc(crew.colour)}"></span>${esc(crew.name)}</div>${cells}</div>`;
  }).join("");

  const end = addDays(ui.weekStart, 6);
  return `
    <div class="weeknav">
      ${toggle}
      <button class="btn sm" data-act="week-prev" aria-label="Previous week">${icon("back")}</button>
      <button class="btn sm" data-act="week-next" aria-label="Next week">${icon("chev")}</button>
      <span class="weeklabel">${fmtDate(ui.weekStart)} – ${fmtDate(end)} ${parseISO(end).getFullYear()}</span>
      <button class="btn sm ghost" data-act="week-today">This week</button>
    </div>
    <div class="sched"><div class="sgrid">${head}${rows || `<div class="empty">No crews yet — add one in Settings.</div>`}</div></div>`;
}

/* ---------------- shared: won-but-not-booked ---------------- */

function unbookedCard(ctx) {
  const { state } = ctx;
  const unbooked = state.leads.filter((l) => l.stage === "won" && !l.job?.startDate);
  if (!unbooked.length) return "";
  return `<section class="card" style="margin-top:16px">
    <div class="card-h"><h3>Won but not booked in</h3><span class="n">${unbooked.length}</span></div>
    <div class="card-b flush"><div class="queue">${unbooked.map((l) => {
      const q = quoteFor(l, state.rates, state.business.vat);
      return `<div class="qrow" data-open="${l.id}"><span class="qmark warn"></span>
        <div class="qmain"><div class="qname">${esc(l.name)}</div>
          <div class="qmeta">${q.area} m² · about ${q.days} day${q.days > 1 ? "s" : ""} of work · ${esc(l.postcode || "")}</div></div>
        <div class="qright"><span class="pill warn"><span class="pdot"></span>Needs a date</span></div></div>`;
    }).join("")}</div></div></section>`;
}
