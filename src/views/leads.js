// Every enquiry in one sortable, filterable table — the CRM list view.
import { esc, money, num, fmtDate } from "../util.js";
import { quoteFor, actionState, isCold, stage, STAGES, CHANNELS, channelLabel } from "../model.js";
import { leadValue } from "../analytics.js";
import { icon } from "../icons.js";

const COLS = [
  { key: "name", label: "Name", get: (l) => (l.name || "").toLowerCase() },
  { key: "stage", label: "Stage", get: (l) => STAGES.findIndex((s) => s.id === l.stage) },
  { key: "source", label: "Source", get: (l) => (l.source || "").toLowerCase() },
  { key: "area", label: "Area", get: (l) => num(l.survey?.areaM2, 0), num: true },
  { key: "value", label: "Quote", get: (l, ctx) => leadValue(l, ctx.state), num: true },
  { key: "next", label: "Next action", get: (l) => l.nextAction || "9999" },
  { key: "created", label: "Added", get: (l) => l.createdAt || "" }
];

export function renderLeads(ctx) {
  const { state, ui } = ctx;
  const q = ui.search.trim().toLowerCase();
  const sort = ui.leadSort;

  const sources = [...new Set(state.leads.map((l) => l.source).filter(Boolean))].sort();

  let rows = state.leads.filter((l) => {
    if (ui.leadStage && l.stage !== ui.leadStage) return false;
    if (ui.leadSource && (l.source || "") !== ui.leadSource) return false;
    if (ui.leadChannel && (l.channel || "manual") !== ui.leadChannel) return false;
    if (q && ![l.name, l.address, l.postcode, l.phone, l.source, l.campaign]
      .join(" ").toLowerCase().includes(q)) return false;
    return true;
  });

  const col = COLS.find((c) => c.key === sort.col) ?? COLS[6];
  rows = rows.map((l) => l).sort((a, b) => {
    const va = col.get(a, ctx), vb = col.get(b, ctx);
    if (va < vb) return -sort.dir;
    if (va > vb) return sort.dir;
    return 0;
  });

  const totalValue = rows.reduce((s, l) => s + leadValue(l, state), 0);

  const head = COLS.map((c) => {
    const active = c.key === sort.col;
    const arrow = active ? (sort.dir === 1 ? " ▲" : " ▼") : "";
    return `<th class="${c.num ? "r" : ""}${active ? " on" : ""}" data-sort="${c.key}">${esc(c.label)}${arrow}</th>`;
  }).join("");

  const body = rows.map((l) => {
    const a = actionState(l);
    const v = leadValue(l, state);
    const st = stage(l.stage);
    const flag = a.kind === "overdue" ? "crit" : a.kind === "today" ? "warn" : a.tone;
    return `<tr data-open="${l.id}">
      <td>
        <div class="lt-name">${esc(l.name || "Unnamed enquiry")}</div>
        <div class="lt-sub">${esc(l.postcode || l.address || "No address yet")}</div>
      </td>
      <td><span class="pill ${stageTone(l.stage)}">${esc(st.label)}</span>${isCold(l) ? ` <span class="pill neutral">Cold</span>` : ""}</td>
      <td>${l.source ? esc(l.source) : "<span class='lt-dim'>—</span>"}
        <div class="lt-sub">${esc([channelLabel(l.channel), l.campaign].filter(Boolean).join(" · "))}</div></td>
      <td class="r num">${l.survey?.areaM2 ? num(l.survey.areaM2) + " m²" : "<span class='lt-dim'>—</span>"}</td>
      <td class="r num">${v > 0 ? money(v) : "<span class='lt-dim'>—</span>"}</td>
      <td>${l.nextAction
        ? `<span class="pill ${flag}"><span class="pdot"></span>${esc(a.kind === "overdue" || a.kind === "today" ? a.label : fmtDate(l.nextAction))}</span>`
        : "<span class='lt-dim'>None set</span>"}</td>
      <td class="num lt-dim">${fmtDate(l.createdAt)}</td>
    </tr>`;
  }).join("");

  return `
    <div class="toolbar">
      <div class="search">${icon("search", "")}<input class="inp" id="q" placeholder="Search name, address, postcode, phone…" value="${esc(ui.search)}"></div>
      <select class="inp sel" id="leadstage">
        <option value="">All stages</option>
        ${STAGES.map((s) => `<option value="${s.id}"${ui.leadStage === s.id ? " selected" : ""}>${esc(s.label)}</option>`).join("")}
      </select>
      <select class="inp sel" id="leadsource">
        <option value="">All sources</option>
        ${sources.map((s) => `<option${ui.leadSource === s ? " selected" : ""}>${esc(s)}</option>`).join("")}
      </select>
      <select class="inp sel" id="leadchannel">
        <option value="">Calls &amp; forms</option>
        ${CHANNELS.map((c) => `<option value="${c.id}"${ui.leadChannel === c.id ? " selected" : ""}>${esc(c.label)}</option>`).join("")}
      </select>
      ${(ui.leadStage || ui.leadSource || ui.leadChannel || ui.search) ? `<button class="btn sm ghost" data-act="leads-clear">Clear</button>` : ""}
      <span class="lt-count">${rows.length} of ${state.leads.length} · ${money(totalValue)}</span>
    </div>
    ${rows.length ? `<div class="ltwrap"><table class="ltable">
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table></div>`
    : `<div class="card"><div class="empty" style="padding:44px 20px">
        <strong>No records match</strong>Nothing here for those filters.</div></div>`}`;
}

function stageTone(id) {
  if (["won", "installed"].includes(id)) return "good";
  if (id === "lost") return "neutral";
  if (id === "quoted") return "info";
  return "warn";
}
