// Phone-first job sheets for the fitters.
import { esc, todayISO, dayDiff, fmtDate, fmtDateLong } from "../util.js";
import { quoteFor, materialsFor, leadName } from "../model.js";
import { icon } from "../icons.js";

export function renderJobs(ctx) {
  const { state, ui } = ctx;
  const today = todayISO();

  const picker = `<div class="toolbar">
    <label class="lbl" for="crewpick" style="margin:0 6px 0 0;align-self:center">Crew</label>
    <select class="inp" id="crewpick" style="max-width:200px">
      <option value="">All crews</option>
      ${state.crews.map((c) => `<option value="${c.id}"${ui.deviceCrew === c.id ? " selected" : ""}>${esc(c.name)}</option>`).join("")}
    </select></div>`;

  const jobs = state.leads
    .filter((l) => l.job?.startDate && (!ui.deviceCrew || l.job.crewId === ui.deviceCrew) && dayDiff(today, l.job.startDate) >= -30)
    .sort((a, b) => (a.job.startDate < b.job.startDate ? -1 : 1));

  if (!jobs.length) {
    return picker + `<div class="card"><div class="empty"><strong>No jobs on the sheet</strong>Nothing booked for this crew yet.</div></div>`;
  }

  return picker + `<div class="jslist">${jobs.map((l) => {
    const q = quoteFor(l, state.rates, state.business.vat);
    const crew = state.crews.find((c) => c.id === l.job.crewId);
    const d = dayDiff(today, l.job.startDate);
    const done = l.job.status === "complete";
    const when = d === 0 ? "Today" : d === 1 ? "Tomorrow"
      : d < 0 ? `${done ? "Completed" : "Was due"} ${fmtDate(done ? l.job.completedAt : l.job.startDate)}`
      : fmtDateLong(l.job.startDate);
    const open = l.id === ui.expandedJob;

    const body = open ? `<div class="jsheet-b">
      <dl class="speclist">
        <dt>Address</dt><dd>${esc(`${l.address || ""} ${l.postcode || ""}`.trim() || "—")}</dd>
        <dt>Contact</dt><dd>${esc(l.phone || "—")}</dd>
        <dt>Area</dt><dd>${q.area} m²</dd>
        <dt>Grass</dt><dd>${esc(q.grass.name)}</dd>
        <dt>Duration</dt><dd>${l.job.days || 1} day${(l.job.days || 1) > 1 ? "s" : ""}</dd>
        <dt>Crew</dt><dd>${esc(crew?.name ?? "Unassigned")}</dd>
      </dl>
      <div class="lbl">Materials to load</div>
      <ul class="matlist">${materialsFor(l, state.rates, state.business.vat)
        .map((m) => `<li><span>${esc(m.label)}</span><span>${esc(m.qty)}</span></li>`).join("")}</ul>
      ${l.survey?.notes ? `<div class="lbl">Site notes</div><p style="margin:0 0 14px;font-size:13px">${esc(l.survey.notes)}</p>` : ""}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${done ? `<span class="pill good"><span class="pdot"></span>Completed ${fmtDate(l.job.completedAt)}</span>`
               : `<button class="btn primary sm" data-act="complete" data-id="${l.id}">${icon("check")}Mark complete</button>`}
        ${ui.role === "fitters" ? "" : `<button class="btn sm" data-open="${l.id}">Open full record</button>`}
      </div>
    </div>` : "";

    return `<article class="jsheet">
      <div class="jsheet-h" data-toggle="${l.id}">
        <div style="flex:1;min-width:0">
          <div class="d">${esc(when)}</div>
          <div class="n">${esc(leadName(l))}</div>
          <div class="ad">${esc(`${l.address || ""} ${l.postcode || ""}`.trim())}</div>
        </div>
        <div style="flex:none;display:flex;align-items:center;gap:8px">
          ${done ? `<span class="pill good">Done</span>` : `<span class="pill neutral">${q.area} m²</span>`}
          ${icon(open ? "x" : "chev")}
        </div>
      </div>${body}</article>`;
  }).join("")}</div>`;
}
