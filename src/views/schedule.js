// Week grid of crews against days, with clash detection.
import { esc, addDays, parseISO, todayISO, dayDiff, fmtDate } from "../util.js";
import { quoteFor, jobsOn } from "../model.js";
import { icon } from "../icons.js";

export function renderSchedule(ctx) {
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

  const unbooked = state.leads.filter((l) => l.stage === "won" && !l.job?.startDate);
  const unbookedCard = unbooked.length ? `
    <section class="card" style="margin-top:16px">
      <div class="card-h"><h3>Won but not booked in</h3><span class="n">${unbooked.length}</span></div>
      <div class="card-b flush"><div class="queue">${unbooked.map((l) => {
        const q = quoteFor(l, state.rates, state.business.vat);
        return `<div class="qrow" data-open="${l.id}"><span class="qmark warn"></span>
          <div class="qmain"><div class="qname">${esc(l.name)}</div>
            <div class="qmeta">${q.area} m² · about ${q.days} day${q.days > 1 ? "s" : ""} of work · ${esc(l.postcode || "")}</div></div>
          <div class="qright"><span class="pill warn"><span class="pdot"></span>Needs a date</span></div></div>`;
      }).join("")}</div></div></section>` : "";

  const end = addDays(ui.weekStart, 6);
  return `
    <div class="weeknav">
      <button class="btn sm" data-act="week-prev" aria-label="Previous week">${icon("back")}</button>
      <button class="btn sm" data-act="week-next" aria-label="Next week">${icon("chev")}</button>
      <span class="weeklabel">${fmtDate(ui.weekStart)} – ${fmtDate(end)} ${parseISO(end).getFullYear()}</span>
      <button class="btn sm ghost" data-act="week-today">This week</button>
    </div>
    <div class="sched"><div class="sgrid">${head}${rows || `<div class="empty">No crews yet — add one in Settings.</div>`}</div></div>
    ${unbookedCard}`;
}
