// Cold-outreach list — nurseries, care homes, schools, colleges and public
// spaces worth calling or emailing about artificial grass. Separate from
// Leads: nobody's enquired yet, this is Aaron's own call list. Ticking
// "Contacted" just marks it done — nothing is ever removed by that tick.
import { esc, fmtDate } from "../util.js";
import { PROSPECT_TYPES, prospectTypeLabel } from "../model.js";
import { icon } from "../icons.js";

export function renderProspects(ctx) {
  const { state, ui } = ctx;
  const q = ui.prospectSearch.trim().toLowerCase();

  let rows = (state.prospects ?? []).filter((p) => {
    if (ui.prospectType && p.type !== ui.prospectType) return false;
    if (ui.prospectFilter === "open" && p.contacted) return false;
    if (ui.prospectFilter === "contacted" && !p.contacted) return false;
    if (q && ![p.name, p.contactName, p.phone, p.email, p.address, p.notes]
      .join(" ").toLowerCase().includes(q)) return false;
    return true;
  });

  // Still-to-call first; within each group, newest first.
  rows = rows.slice().sort((a, b) => {
    if (a.contacted !== b.contacted) return a.contacted ? 1 : -1;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });

  const total = state.prospects?.length ?? 0;
  const openCount = (state.prospects ?? []).filter((p) => !p.contacted).length;

  const row = (p) => `<tr data-prospect-row="${p.id}" class="${p.contacted ? "done" : ""}">
    <td>
      <div class="pstack">
        <input class="inp" data-prospect="${p.id}" data-field="name" value="${esc(p.name)}" placeholder="Business / site name">
        <select class="inp" data-prospect="${p.id}" data-field="type">
          ${PROSPECT_TYPES.map((t) => `<option value="${t.id}"${p.type === t.id ? " selected" : ""}>${esc(t.label)}</option>`).join("")}
        </select>
      </div>
    </td>
    <td>
      <div class="pstack">
        <input class="inp" data-prospect="${p.id}" data-field="contactName" value="${esc(p.contactName)}" placeholder="Who to ask for">
        <input class="inp" data-prospect="${p.id}" data-field="phone" value="${esc(p.phone)}" placeholder="Phone">
        <input class="inp" data-prospect="${p.id}" data-field="email" value="${esc(p.email)}" placeholder="Email">
        <input class="inp" data-prospect="${p.id}" data-field="address" value="${esc(p.address)}" placeholder="Address">
      </div>
    </td>
    <td>
      <textarea class="inp" rows="3" data-prospect="${p.id}" data-field="notes" placeholder="Notes after you've called or emailed…">${esc(p.notes)}</textarea>
    </td>
    <td class="r">
      <label class="pcheck">
        <input type="checkbox" data-prospect="${p.id}" data-field="contacted"${p.contacted ? " checked" : ""}>
        <span>${p.contacted ? "Contacted" : "Mark contacted"}</span>
      </label>
      ${p.contactedAt ? `<div class="lt-sub">${esc(fmtDate(p.contactedAt))}</div>` : ""}
      <button class="todo-x" data-act="del-prospect" data-id="${p.id}" aria-label="Delete" title="Remove for good">${icon("x")}</button>
    </td>
  </tr>`;

  return `
    <div class="toolbar">
      <div class="search">${icon("search", "")}<input class="inp" id="pq" placeholder="Search name, contact, phone, email…" value="${esc(ui.prospectSearch)}"></div>
      <select class="inp sel" id="prospecttype">
        <option value="">All types</option>
        ${PROSPECT_TYPES.map((t) => `<option value="${t.id}"${ui.prospectType === t.id ? " selected" : ""}>${esc(t.label)}</option>`).join("")}
      </select>
      <select class="inp sel" id="prospectfilter">
        <option value="">All</option>
        <option value="open"${ui.prospectFilter === "open" ? " selected" : ""}>Not yet contacted</option>
        <option value="contacted"${ui.prospectFilter === "contacted" ? " selected" : ""}>Contacted</option>
      </select>
      <div class="spacer"></div>
      <button class="btn primary sm" data-act="add-prospect">${icon("plus")}Add prospect</button>
      <span class="lt-count">${openCount} to contact · ${total} total</span>
    </div>
    ${rows.length ? `<div class="ltwrap"><table class="ltable ptable">
      <thead><tr><th>Business</th><th>Contact</th><th>Notes</th><th class="r">Status</th></tr></thead>
      <tbody>${rows.map(row).join("")}</tbody>
    </table></div>`
    : `<div class="card"><div class="empty" style="padding:44px 20px">
        <strong>Nothing on the list yet</strong>Add a nursery, care home, school or public space worth calling.</div></div>`}`;
}
