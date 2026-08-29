// Wiring: view routing, event delegation, persistence.
import { esc, todayISO, addDays, mondayOf, setPath, fmtDate } from "./util.js";
import { quoteFor, actionState, setStage, logActivity, stage, estimateDays } from "./model.js";
import { defaultState, normalise, newLead, loadLocal, saveLocal, sampleLeads, seededState, CREW_COLOURS } from "./state.js";
import { icon } from "./icons.js";
import { renderToday } from "./views/today.js";
import { renderLeads } from "./views/leads.js";
import { renderPipeline } from "./views/pipeline.js";
import { renderSchedule } from "./views/schedule.js";
import { renderAnalytics } from "./views/analytics.js";
import { renderJobs } from "./views/jobs.js";
import { renderSettings } from "./views/settings.js";
import { renderDrawer, quoteBreakdown } from "./views/drawer.js";

let state = loadLocal() ?? seededState();

const ui = {
  view: "today",
  openId: null,        // record shown in the drawer
  expandedJob: null,   // job sheet expanded inline
  weekStart: mondayOf(todayISO()),
  search: "",
  showClosed: false,
  leadSort: { col: "created", dir: -1 },  // Leads table sort
  leadStage: "",
  leadSource: "",
  deviceCrew: localStorage.getItem("turfline-crew") || null, // per-device, not shared
  readOnly: false,
  saveState: "idle"
};

const ctx = { get state() { return state; }, ui };
const leadById = (id) => state.leads.find((l) => l.id === id);
const VIEWS = {
  today: { title: "Today", sub: "What needs you, right now", render: renderToday },
  leads: { title: "Leads", sub: "Every enquiry, sortable and searchable", render: renderLeads },
  pipeline: { title: "Pipeline", sub: "Every live enquiry by stage", render: renderPipeline },
  schedule: { title: "Schedule", sub: "Crews, jobs and clashes", render: renderSchedule },
  analytics: { title: "Analytics", sub: "Funnel, win rate and where the money comes from", render: renderAnalytics },
  jobs: { title: "Job sheets", sub: "For the fitters — open on a phone", render: renderJobs },
  settings: { title: "Settings", sub: "Rates, crews and your data", render: renderSettings }
};

/* ---------------- persistence ---------------- */
let saveTimer;
function save() {
  ui.saveState = "pending";
  paintSaveChip();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    ui.saveState = saveLocal(state) ? "saved" : "failed";
    paintSaveChip();
  }, 500);
}
function paintSaveChip() {
  const el = document.getElementById("savechip");
  if (!el) return;
  const chip = {
    idle: ["dot", "Saved"], pending: ["dot pending", "Saving…"],
    saved: ["dot", "Saved"], failed: ["dot off", "Could not save — export a backup"]
  }[ui.saveState];
  el.innerHTML = `<span class="${chip[0]}"></span><span>${esc(chip[1])}</span>`;
}

/* ---------------- render ---------------- */
function badgeCounts() {
  const today = todayISO();
  let action = 0, overdue = 0, installs = 0;
  for (const l of state.leads) {
    if (l.stage === "lost") continue;
    const k = actionState(l).kind;
    if (k === "overdue") { overdue++; action++; }
    else if (k === "today") action++;
    const start = l.job?.startDate;
    if (start && l.job.status !== "complete") {
      const d = (new Date(start) - new Date(today)) / 86400000;
      if (d >= 0 && d <= 7) installs++;
    }
  }
  return { action, overdue, installs, pipeline: state.leads.filter((l) => !["installed", "lost"].includes(l.stage)).length };
}

function render() {
  const c = badgeCounts();
  const nav = [
    ["today", "Today", c.action, c.overdue > 0],
    ["leads", "Leads", state.leads.length, false],
    ["pipeline", "Pipeline", c.pipeline, false],
    ["schedule", "Schedule", c.installs, false],
    ["analytics", "Analytics", 0, false],
    ["jobs", "Job sheets", 0, false],
    ["settings", "Settings", 0, false]
  ];
  const v = VIEWS[ui.view];

  document.getElementById("app").innerHTML = `
    <div class="shell">
      <nav class="rail" aria-label="Sections">
        <div class="brand">
          <img class="brand-logo" src="src/assets/yate-logo.png" alt="${esc(state.business.name)}">
          <span class="brand-sub">Lead &amp; job manager</span></div>
        ${nav.map(([id, label, count, hot]) => `<button class="navbtn" data-nav="${id}" aria-current="${ui.view === id}">
          ${icon(id)}<span>${esc(label)}</span>${count > 0 ? `<span class="cnt${hot ? " hot" : ""}">${count}</span>` : ""}</button>`).join("")}
        <div class="rail-foot"><div class="savechip" id="savechip"></div></div>
      </nav>
      <div class="main">
        <header class="topbar">
          <div><h1>${esc(v.title)}</h1><div class="sub">${esc(v.sub)}</div></div>
          <div class="spacer"></div>
          ${ui.readOnly ? "" : `<button class="btn primary" data-act="new">${icon("plus")}New enquiry</button>`}
        </header>
        <div class="content">${v.render(ctx)}</div>
      </div>
    </div>
    ${ui.openId && leadById(ui.openId) ? renderDrawer(ctx, leadById(ui.openId)) : ""}`;
  paintSaveChip();
}

/** Update just the parts of the open drawer that depend on typed values. */
function refreshDrawerTotals(lead) {
  const q = quoteFor(lead, state.rates, state.business.vat);
  const title = document.querySelector(".drawer-h h2");
  const sub = document.querySelector(".drawer-h .s");
  const out = document.querySelector(".quote-out");
  if (title) title.textContent = lead.name || "New enquiry";
  if (sub) sub.textContent = `${stage(lead.stage).label} · ${lead.postcode || lead.address || "no address"} · £${Math.round(q.total).toLocaleString("en-GB")}`;
  if (out) out.innerHTML = quoteBreakdown(lead, state);
}

/* ---------------- events ---------------- */
document.addEventListener("click", (e) => {
  const hit = (sel) => e.target.closest(sel);
  let el;

  if ((el = hit("[data-nav]"))) { ui.view = el.dataset.nav; ui.openId = null; return render(); }
  if ((el = hit("[data-open]"))) { ui.openId = el.dataset.open; return render(); }
  if ((el = hit("[data-toggle]"))) { ui.expandedJob = ui.expandedJob === el.dataset.toggle ? null : el.dataset.toggle; return render(); }
  if ((el = hit("[data-sort]"))) {
    const col = el.dataset.sort;
    ui.leadSort = ui.leadSort.col === col
      ? { col, dir: -ui.leadSort.dir }
      : { col, dir: ["name", "source"].includes(col) ? 1 : -1 };
    return render();
  }

  const lead = leadById(ui.openId);
  if ((el = hit("[data-stage]")) && lead && !ui.readOnly) { setStage(lead, el.dataset.stage); save(); return render(); }
  if ((el = hit("[data-snooze]")) && lead && !ui.readOnly) {
    lead.nextAction = addDays(lead.nextAction || todayISO(), Number(el.dataset.snooze));
    logActivity(lead, `Follow-up pushed to ${fmtDate(lead.nextAction)}`);
    save(); return render();
  }

  el = hit("[data-act]");
  if (!el) return;
  const act = el.dataset.act;
  if (act === "close") { ui.openId = null; return render(); }
  if (ui.readOnly && act !== "export") return;

  switch (act) {
    case "new": {
      const l = newLead(state.rates);
      state.leads.unshift(l);
      ui.openId = l.id;
      if (["jobs", "settings", "analytics"].includes(ui.view)) ui.view = "leads";
      save(); render();
      document.querySelector('[data-f="name"]')?.focus();
      break;
    }
    case "seed": state.leads = sampleLeads(state.rates); save(); render(); break;
    case "leads-clear": ui.leadStage = ui.leadSource = ui.search = ""; render(); break;
    case "toggle-closed": ui.showClosed = !ui.showClosed; render(); break;
    case "week-prev": ui.weekStart = addDays(ui.weekStart, -7); render(); break;
    case "week-next": ui.weekStart = addDays(ui.weekStart, 7); render(); break;
    case "week-today": ui.weekStart = mondayOf(todayISO()); render(); break;
    case "done-action": {
      if (!lead) break;
      logActivity(lead, `Done: ${lead.nextNote || "follow-up"}`);
      const chase = stage(lead.stage).chase;
      lead.nextAction = chase > 0 ? addDays(todayISO(), chase) : null;
      lead.nextNote = "";
      save(); render();
      break;
    }
    case "complete": {
      const l = leadById(el.dataset.id);
      if (!l) break;
      l.job = { ...l.job, status: "complete", completedAt: todayISO() };
      if (l.stage === "won") setStage(l, "installed");
      logActivity(l, "Install marked complete");
      save(); render();
      break;
    }
    case "del-lead": {
      if (!confirm("Delete this record for good?")) break;
      state.leads = state.leads.filter((l) => l.id !== el.dataset.id);
      ui.openId = null; save(); render();
      break;
    }
    case "add-crew":
      state.crews.push({ id: crypto.randomUUID().slice(0, 8), name: `Crew ${String.fromCharCode(65 + state.crews.length)}`, colour: CREW_COLOURS[state.crews.length % CREW_COLOURS.length] });
      save(); render();
      break;
    case "del-crew": {
      const removed = state.crews.splice(Number(el.dataset.i), 1)[0];
      for (const l of state.leads) if (l.job?.crewId === removed?.id) l.job.crewId = "";
      save(); render();
      break;
    }
    case "add-grass": state.rates.grasses.push({ name: "New grass", rate: 15 }); save(); render(); break;
    case "export": exportData(); break;
    case "import": document.getElementById("importfile").click(); break;
    case "wipe":
      if (!confirm("Delete every record? This cannot be undone.")) break;
      state = normalise(defaultState()); ui.openId = null; save(); render();
      break;
  }
});

document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.id === "q") {
    ui.search = t.value;
    const pos = t.selectionStart;
    render();
    const again = document.getElementById("q");
    again?.focus();
    again?.setSelectionRange(pos, pos);
    return;
  }
  if (t.id === "leadstage") { ui.leadStage = t.value; return render(); }
  if (t.id === "leadsource") { ui.leadSource = t.value; return render(); }
  if (t.id === "crewpick") {
    ui.deviceCrew = t.value || null;
    ui.deviceCrew ? localStorage.setItem("turfline-crew", ui.deviceCrew) : localStorage.removeItem("turfline-crew");
    return render();
  }
  if (ui.readOnly) return;

  if (t.dataset.f) {
    const lead = leadById(ui.openId);
    if (!lead) return;
    let value = t.type === "checkbox" ? t.checked : t.type === "number" ? (t.value === "" ? "" : parseFloat(t.value)) : t.value;
    if (t.dataset.f === "nextAction" && !value) value = null;
    setPath(lead, t.dataset.f, value);
    if (t.dataset.f === "job.startDate" && value && !lead.job.days) lead.job.days = estimateDays(lead.survey?.areaM2, state.rates);
    save();
    refreshDrawerTotals(lead);
    return;
  }
  if (t.dataset.rate !== undefined) { state.rates[t.dataset.rate] = t.value === "" ? 0 : parseFloat(t.value); return save(); }
  if (t.dataset.grassName !== undefined) { state.rates.grasses[Number(t.dataset.grassName)].name = t.value; return save(); }
  if (t.dataset.grassRate !== undefined) { state.rates.grasses[Number(t.dataset.grassRate)].rate = parseFloat(t.value) || 0; return save(); }
  if (t.dataset.crew !== undefined) { state.crews[Number(t.dataset.crew)].name = t.value; return save(); }
  if (t.dataset.biz) { state.business[t.dataset.biz] = t.type === "checkbox" ? t.checked : t.value; return save(); }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && ui.openId) { ui.openId = null; render(); }
});

/* ---------------- pipeline drag-and-drop ---------------- */
let dragLeadId = null;
const clearDropHints = () => document.querySelectorAll(".col.drag-over").forEach((c) => c.classList.remove("drag-over"));

document.addEventListener("dragstart", (e) => {
  const card = e.target.closest("[data-lead]");
  if (!card || ui.readOnly) return;
  dragLeadId = card.dataset.lead;
  card.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", dragLeadId);
});
document.addEventListener("dragend", () => {
  document.querySelectorAll(".lcard.dragging").forEach((c) => c.classList.remove("dragging"));
  clearDropHints();
  dragLeadId = null;
});
document.addEventListener("dragover", (e) => {
  if (dragLeadId == null) return;
  const col = e.target.closest("[data-drop-stage]");
  if (!col) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  if (!col.classList.contains("drag-over")) { clearDropHints(); col.classList.add("drag-over"); }
});
document.addEventListener("drop", (e) => {
  const col = e.target.closest("[data-drop-stage]");
  clearDropHints();
  if (!col) return;
  e.preventDefault();
  const lead = leadById(dragLeadId || e.dataTransfer.getData("text/plain"));
  const target = col.dataset.dropStage;
  dragLeadId = null;
  if (!lead || ui.readOnly || lead.stage === target) return;
  setStage(lead, target);
  save();
  render();
});

/* ---------------- backup ---------------- */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `turfline-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

document.getElementById("importfile").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    state = normalise(JSON.parse(await file.text()));
    save(); render();
  } catch {
    alert("That file could not be read as a Turfline backup.");
  }
  e.target.value = "";
});

render();
