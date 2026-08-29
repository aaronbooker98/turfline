// Board of live enquiries by stage.
import { esc, money } from "../util.js";
import { quoteFor, actionState, isCold, stage, BOARD_STAGES } from "../model.js";
import { icon } from "../icons.js";

function card(lead, total) {
  const a = actionState(lead);
  const flag = a.kind === "overdue"
    ? `<span class="pill crit"><span class="pdot"></span>${esc(a.label)}</span>`
    : a.kind === "today" ? `<span class="pill warn"><span class="pdot"></span>Today</span>` : "";
  return `<div class="lcard" data-open="${lead.id}" data-lead="${lead.id}" draggable="true">
    <div class="n">${esc(lead.name || "Unnamed")}</div>
    <div class="a">${esc(lead.postcode || lead.address || "No address yet")}</div>
    <div class="f">${flag}
      ${isCold(lead) ? `<span class="pill neutral">Cold</span>` : ""}
      ${lead.source ? `<span class="pill info">${esc(lead.source)}</span>` : ""}
      <span class="v">${money(total)}</span>
    </div></div>`;
}

export function renderPipeline(ctx) {
  const { state, ui } = ctx;
  const q = ui.search.trim().toLowerCase();
  const value = (l) => quoteFor(l, state.rates, state.business.vat).total;
  const matches = state.leads.filter((l) =>
    !q || [l.name, l.address, l.postcode, l.phone, l.source, l.campaign].join(" ").toLowerCase().includes(q));

  const columns = ui.showClosed ? [...BOARD_STAGES, "installed", "lost"] : BOARD_STAGES;

  return `
    <div class="toolbar">
      <div class="search">${icon("search", "")}<input class="inp" id="q" placeholder="Search name, address, postcode…" value="${esc(ui.search)}"></div>
      <button class="btn sm" data-act="toggle-closed">${ui.showClosed ? "Hide closed" : "Show closed"}</button>
      <span class="pipe-hint">Drag a card between columns to move it along</span>
    </div>
    <div class="board">${columns.map((id) => {
      const items = matches.filter((l) => l.stage === id);
      const total = items.reduce((s, l) => s + value(l), 0);
      return `<div class="col" data-drop-stage="${id}">
        <div class="col-h"><span class="t">${esc(stage(id).label)}</span><span class="c">${items.length} · ${money(total)}</span></div>
        <div class="col-b">${items.length ? items.map((l) => card(l, value(l))).join("") : `<div class="empty" style="padding:18px 8px;font-size:12px">Empty</div>`}</div>
      </div>`;
    }).join("")}</div>`;
}
