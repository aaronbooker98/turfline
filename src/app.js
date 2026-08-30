// Wiring: auth, view routing, event delegation, and syncing state to Supabase.
import { esc, todayISO, addDays, mondayOf, firstOfMonth, addMonths, setPath, fmtDate } from "./util.js";
import { quoteFor, actionState, setStage, logActivity, stage, estimateDays } from "./model.js";
import { normalise, newLead, CREW_COLOURS } from "./state.js";
import { icon } from "./icons.js";
import * as db from "./db.js";
import { renderLogin } from "./views/login.js";
import { renderToday } from "./views/today.js";
import { renderLeads } from "./views/leads.js";
import { renderPipeline } from "./views/pipeline.js";
import { renderSchedule } from "./views/schedule.js";
import { renderAnalytics } from "./views/analytics.js";
import { renderJobs } from "./views/jobs.js";
import { renderSettings } from "./views/settings.js";
import { renderEstimator, estimatorResults } from "./views/estimator.js";
import { renderDrawer, quoteBreakdown } from "./views/drawer.js";
import { buildQuoteDoc } from "./views/quote-doc.js";

let state = null;          // null until signed in and loaded
let lastSaved = null;      // snapshot of the last state pushed to the server
let unsub = null;          // realtime unsubscribe
let lastLocalEdit = 0;     // ms — used to ignore our own writes echoing back

// Scratch state for the Quote estimator (never saved).
function freshEst() {
  return { mode: "area", area: "", w: "", l: "", grass: "", days: "", crewDayRate: "",
           priceMode: "margin", marginPct: "", pricePerM2: "", accessPct: "", off: {} };
}

const ui = {
  view: "today",
  openId: null,
  expandedJob: null,
  weekStart: mondayOf(todayISO()),
  schedView: "week",
  monthStart: firstOfMonth(todayISO()),
  search: "",
  showClosed: false,
  leadSort: { col: "created", dir: -1 },
  leadStage: "",
  leadSource: "",
  leadChannel: "",
  est: freshEst(),
  deviceCrew: localStorage.getItem("turfline-crew") || null,
  readOnly: false,
  saveState: "idle",
  role: null,              // 'office' | 'fitters'
  session: false,
  authError: "",
  authBusy: false,
  bootError: ""
};

const ctx = { get state() { return state; }, ui };
const leadById = (id) => state?.leads.find((l) => l.id === id);

const VIEWS = {
  today: { title: "Today", sub: "What needs you, right now", render: renderToday },
  leads: { title: "Leads", sub: "Every enquiry, sortable and searchable", render: renderLeads },
  pipeline: { title: "Pipeline", sub: "Every live enquiry by stage", render: renderPipeline },
  schedule: { title: "Schedule", sub: "Crews, jobs and clashes", render: renderSchedule },
  analytics: { title: "Analytics", sub: "Funnel, win rate and where the money comes from", render: renderAnalytics },
  estimator: { title: "Quote estimator", sub: "A quick ballpark price — no record needed", render: renderEstimator },
  jobs: { title: "Job sheets", sub: "For the fitters — open on a phone", render: renderJobs },
  settings: { title: "Settings", sub: "Rates, crews and your data", render: renderSettings }
};
const OFFICE_NAV = ["today", "estimator", "leads", "pipeline", "schedule", "analytics", "jobs", "settings"];
const FITTER_NAV = ["jobs", "schedule"];
const navFor = () => (ui.role === "fitters" ? FITTER_NAV : OFFICE_NAV);

/* ---------------- boot / auth ---------------- */

async function boot() {
  try {
    const session = await db.getSession();
    if (!session) { ui.session = false; return render(); }
    ui.role = await db.myRole();
    if (ui.role !== "office" && ui.role !== "fitters") {
      await db.signOut();
      ui.session = false;
      ui.authError = "This login has no access set up yet.";
      return render();
    }
    ui.session = true;
    ui.readOnly = ui.role === "fitters";
    if (!navFor().includes(ui.view)) ui.view = navFor()[0];
    await reload();
    wireRealtime();
    render();
  } catch (e) {
    console.error(e);
    ui.session = false;
    ui.authError = "Could not reach the server. Check your connection and try again.";
    render();
  }
}

async function reload() {
  const fresh = ui.role === "fitters" ? await db.loadFittersState() : await db.loadOfficeState();
  state = ui.role === "fitters" ? fixFitters(fresh) : normalise(fresh);
  lastSaved = structuredClone(state);
}

function fixFitters(s) {
  s.crews ??= []; s.leads ??= [];
  for (const l of s.leads) { l.survey ??= {}; l.quote ??= {}; l.job ??= {}; l.activity ??= []; }
  return s;
}

function wireRealtime() {
  unsub?.();
  unsub = null;
  if (ui.role === "fitters") return; // fitters can't subscribe (RLS); they refresh on focus
  let t;
  unsub = db.subscribeOffice(() => {
    if (Date.now() - lastLocalEdit < 4000) return;   // our own change coming back
    clearTimeout(t);
    t = setTimeout(async () => {
      if (ui.openId || ui.saveState === "pending") return; // don't stomp an edit in progress
      try { await reload(); render(); } catch (e) { console.error(e); }
    }, 500);
  });
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden || !ui.session || ui.role !== "fitters") return;
  reload().then(render).catch(console.error);
});

db.onAuthChange((session) => {
  if (!session && ui.session) {
    unsub?.(); unsub = null;
    ui.session = false; ui.role = null; state = null; ui.openId = null;
    render();
  }
});

/* ---------------- persistence ---------------- */

let saveTimer;
function save() {
  if (ui.readOnly) return;
  lastLocalEdit = Date.now();
  ui.saveState = "pending";
  paintSaveChip();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await db.pushState(state, lastSaved);
      lastSaved = structuredClone(state);
      ui.saveState = "saved";
      try { localStorage.setItem("turfline-cache", JSON.stringify(state)); } catch { /* ignore */ }
    } catch (e) {
      console.error(e);
      ui.saveState = "failed";
    }
    paintSaveChip();
  }, 700);
}

function paintSaveChip() {
  const el = document.getElementById("savechip");
  if (!el) return;
  const chip = {
    idle: ["dot", "Saved"], pending: ["dot pending", "Saving…"],
    saved: ["dot", "Saved"], failed: ["dot off", "Not saved — check connection"]
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
  const root = document.getElementById("app");

  if (!ui.session) {
    root.innerHTML = renderLogin({ error: ui.authError, busy: ui.authBusy });
    if (!ui.authBusy) document.getElementById("li-email")?.focus();
    return;
  }
  if (!state) {
    root.innerHTML = `<div class="login-wrap"><div class="login-card"><p class="login-sub">Loading…</p></div></div>`;
    return;
  }

  const c = badgeCounts();
  const counts = {
    today: [c.action, c.overdue > 0], leads: [state.leads.length, false],
    pipeline: [c.pipeline, false], schedule: [c.installs, false],
    analytics: [0, false], estimator: [0, false], jobs: [0, false], settings: [0, false]
  };
  const nav = navFor().map((id) => [id, VIEWS[id].title, ...counts[id]]);
  const v = VIEWS[ui.view];

  root.innerHTML = `
    <div class="shell">
      <nav class="rail" aria-label="Sections">
        <div class="brand">
          <img class="brand-logo" src="src/assets/yate-logo.png" alt="${esc(state.business.name)}">
          <span class="brand-sub">Lead &amp; job manager</span></div>
        ${nav.map(([id, label, count, hot]) => `<button class="navbtn" data-nav="${id}" aria-current="${ui.view === id}">
          ${icon(id)}<span>${esc(label)}</span>${count > 0 ? `<span class="cnt${hot ? " hot" : ""}">${count}</span>` : ""}</button>`).join("")}
        <div class="rail-foot">
          <div class="savechip" id="savechip"></div>
          <button class="btn ghost sm" data-act="signout">${ui.role === "fitters" ? "Fitters" : "Office"} · Sign out</button>
        </div>
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

document.addEventListener("submit", async (e) => {
  if (e.target.id !== "loginform") return;
  e.preventDefault();
  const fd = new FormData(e.target);
  ui.authBusy = true; ui.authError = ""; render();
  try {
    await db.signIn(fd.get("email"), fd.get("password"));
    ui.authBusy = false;
    await boot();
  } catch (err) {
    ui.authBusy = false;
    ui.authError = /invalid login/i.test(err.message) ? "Wrong email or password." : err.message;
    render();
  }
});

document.addEventListener("click", async (e) => {
  if (!ui.session || !state) return;
  const hit = (sel) => e.target.closest(sel);
  let el;

  if ((el = hit("[data-nav]"))) { ui.view = el.dataset.nav; ui.openId = null; return render(); }
  if ((el = hit("[data-open]"))) { if (ui.role === "fitters") return; ui.openId = el.dataset.open; return render(); }
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
  if (act === "close") {
    ui.openId = null; render();
    // after any pending save has flushed, catch up on other people's changes
    if (ui.role !== "fitters") setTimeout(() => {
      if (!ui.openId && ui.saveState !== "pending") reload().then(render).catch(() => {});
    }, 1400);
    return;
  }
  if (act === "signout") {
    if (!confirm("Sign out of Turfline?")) return;
    unsub?.(); unsub = null;
    await db.signOut();
    state = null; ui.session = false; ui.role = null; ui.openId = null;
    return render();
  }
  if (act === "complete" && ui.role === "fitters") {
    const id = el.dataset.id;
    try { await db.markComplete(id); await reload(); render(); }
    catch (err) { alert("Could not mark complete — " + err.message); }
    return;
  }

  // view-only navigation — safe for read-only (fitter) users too
  const navActs = {
    "week-prev": () => (ui.weekStart = addDays(ui.weekStart, -7)),
    "week-next": () => (ui.weekStart = addDays(ui.weekStart, 7)),
    "week-today": () => (ui.weekStart = mondayOf(todayISO())),
    "sched-view": () => (ui.schedView = el.dataset.view),
    "month-prev": () => (ui.monthStart = addMonths(ui.monthStart, -1)),
    "month-next": () => (ui.monthStart = addMonths(ui.monthStart, 1)),
    "month-today": () => (ui.monthStart = firstOfMonth(todayISO()))
  };
  if (navActs[act]) { navActs[act](); return render(); }

  if (ui.readOnly) return;

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
    case "leads-clear": ui.leadStage = ui.leadSource = ui.leadChannel = ui.search = ""; render(); break;
    case "est-mode": ui.est.mode = el.dataset.mode; render(); break;
    case "est-pricemode": ui.est.priceMode = el.dataset.mode; render(); break;
    case "est-reset": ui.est = freshEst(); render(); break;
    case "toggle-closed": ui.showClosed = !ui.showClosed; render(); break;
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
    case "add-grass": state.rates.grasses.push({ name: "New grass", rate: 12 }); save(); render(); break;
    case "print-quote": {
      const l = leadById(el.dataset.id);
      if (!l) break;
      l.quote ??= {};
      if (!l.quote.ref) {
        const n = state.leads.filter((x) => x.quote?.ref).length + 1;
        l.quote.ref = "YAG-" + String(n).padStart(4, "0");
      }
      l.quote.docDate = todayISO();
      logActivity(l, `Quote ${l.quote.ref} produced`);
      save();
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(buildQuoteDoc(l, state, { logoUrl: location.origin + "/src/assets/yate-logo.png" }));
        w.document.close();
      } else {
        alert("Allow pop-ups for this site to open the quote.");
      }
      render();
      break;
    }
    case "export": exportData(); break;
    case "import": document.getElementById("importfile").click(); break;
  }
});

document.addEventListener("input", (e) => {
  if (!ui.session || !state) return;
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
  if (t.id === "leadchannel") { ui.leadChannel = t.value; return render(); }
  if (t.id === "crewpick") {
    ui.deviceCrew = t.value || null;
    ui.deviceCrew ? localStorage.setItem("turfline-crew", ui.deviceCrew) : localStorage.removeItem("turfline-crew");
    return render();
  }
  if (ui.readOnly) return;

  if (t.dataset.est !== undefined || t.dataset.estWork !== undefined) {
    if (t.dataset.estWork !== undefined) ui.est.off[t.dataset.estWork] = !t.checked;
    else ui.est[t.dataset.est] = t.value;
    const out = document.getElementById("est-out");
    if (out) out.innerHTML = estimatorResults(ctx);
    return;
  }

  if (t.dataset.f) {
    const lead = leadById(ui.openId);
    if (!lead) return;
    let value = t.type === "checkbox" ? t.checked : t.type === "number" ? (t.value === "" ? "" : parseFloat(t.value)) : t.value;
    if (t.dataset.f === "nextAction" && !value) value = null;
    setPath(lead, t.dataset.f, value);
    if (t.dataset.f === "job.startDate" && value && !lead.job.days) lead.job.days = estimateDays(lead.survey?.areaM2, state.rates);
    save();
    if (t.dataset.f === "lostReason" || (t.dataset.f.startsWith("payment.") && t.type === "checkbox")) { render(); return; }
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
  if (!file || ui.readOnly) return;
  try {
    const parsed = normalise(JSON.parse(await file.text()));
    state.business = parsed.business;
    state.rates = parsed.rates;
    state.crews = parsed.crews;
    state.leads = parsed.leads;
    save();
    render();
  } catch {
    alert("That file could not be read as a Turfline backup.");
  }
  e.target.value = "";
});

boot();
