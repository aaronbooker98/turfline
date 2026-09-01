// Invoices — a list of every invoice raised, and a simple form to make one
// (blank, or pre-filled from a won job). Prints in the house format.
import { esc, num, money, money2, fmtDate } from "../util.js";
import { invoiceTotals } from "../model.js";
import { icon } from "../icons.js";

const vatPctFor = (state) => (state.business.vat ? num(state.rates.vatPct, 20) : 0);

export function renderInvoices(ctx) {
  const { state, ui } = ctx;
  const editing = ui.invoiceEdit ? state.invoices.find((i) => i.id === ui.invoiceEdit) : null;
  return editing ? invoiceForm(ctx, editing) : invoiceList(ctx);
}

/* ---------------- list ---------------- */

function invoiceList(ctx) {
  const { state } = ctx;
  const rows = [...state.invoices].sort((a, b) => (b.number || 0) - (a.number || 0));
  const list = rows.length ? `<div class="card"><div class="card-b flush"><table class="lt">
    <thead><tr><th>No.</th><th>Date</th><th>Customer</th><th class="r">Total</th><th>Status</th></tr></thead>
    <tbody>${rows.map((inv) => {
      const t = invoiceTotals(inv, vatPctFor(state));
      return `<tr data-invoice="${inv.id}" style="cursor:pointer">
        <td>${esc(String(inv.number ?? "—"))}</td>
        <td>${esc(fmtDate(inv.date))}</td>
        <td>${esc(inv.billTo?.name || "—")}</td>
        <td class="r num">${money(t.total)}</td>
        <td>${inv.paid
          ? `<span class="pill good"><span class="pdot"></span>Paid</span>`
          : `<span class="pill warn"><span class="pdot"></span>Unpaid</span>`}</td></tr>`;
    }).join("")}</tbody></table></div></div>`
    : `<div class="empty"><strong>No invoices yet</strong>Raise your first one — start blank or pull the details from a finished job.</div>`;

  return `
    <div class="toolbar">
      <button class="btn primary" data-act="new-invoice">${icon("plus")}New invoice</button>
      <div class="spacer"></div>
      <span style="font-size:12.5px;color:var(--muted)">Next number: ${esc(String(num(state.business.nextInvoiceNo, 261)))}</span>
    </div>
    ${list}`;
}

/* ---------------- form ---------------- */

function invoiceForm(ctx, inv) {
  const { state } = ctx;
  const jobs = state.leads
    .filter((l) => ["won", "installed"].includes(l.stage))
    .sort((a, b) => (b.stageAt || "").localeCompare(a.stageAt || ""));

  const field = (label, key, value, type = "text", attrs = "") => `
    <div class="field"><label class="lbl">${esc(label)}</label>
      <input class="inp${type === "number" ? " num" : ""}" type="${type}" data-inv="${key}" value="${esc(value ?? "")}" ${attrs}></div>`;

  return `
    <div class="toolbar">
      <button class="btn sm ghost" data-act="invoice-done">${icon("back")}All invoices</button>
      <div class="spacer"></div>
      <button class="btn sm" data-act="print-invoice" data-id="${inv.id}">${icon("jobs")}Print / Save PDF</button>
      <button class="btn sm ghost" data-act="email-invoice" data-id="${inv.id}">Email</button>
      <button class="btn sm ghost" data-act="text-invoice" data-id="${inv.id}">Text</button>
      <button class="btn sm ghost danger" data-act="del-invoice" data-id="${inv.id}">Delete</button>
    </div>

    <div class="grid2" style="align-items:start">
      <section class="card">
        <div class="card-h"><h3>Invoice</h3>
          <label style="margin-left:auto;display:flex;gap:7px;align-items:center;font-size:12.5px">
            <input type="checkbox" data-inv="paid"${inv.paid ? " checked" : ""}> Paid</label></div>
        <div class="card-b">
          <div class="grid2">
            ${field("Invoice number", "number", inv.number, "number", 'step="1"')}
            ${field("Invoice date", "date", inv.date, "date")}
          </div>
          <div class="field"><label class="lbl">Copy details from a job</label>
            <select class="inp" id="inv-fromjob">
              <option value="">— start blank —</option>
              ${jobs.map((l) => `<option value="${l.id}"${inv.leadId === l.id ? " selected" : ""}>${esc(l.name || "Unnamed")}${l.postcode ? " · " + esc(l.postcode) : ""}</option>`).join("")}
            </select></div>

          ${field("Bill to — name", "billTo.name", inv.billTo?.name)}
          <div class="grid2">
            ${field("Bill to — email", "billTo.email", inv.billTo?.email, "email")}
            ${field("Bill to — phone", "billTo.phone", inv.billTo?.phone, "tel")}
          </div>
          <div class="field"><label class="lbl">Bill to — address</label>
            <textarea class="inp" data-inv="billTo.address" rows="3">${esc(inv.billTo?.address ?? "")}</textarea></div>
          ${field("Description", "description", inv.description)}

          <div class="grid2">
            ${field("Amount £", "amount", inv.amount, "number", 'step="0.01" placeholder="0.00"')}
            <div class="field"><label class="lbl">That amount is</label>
              <div class="segbtns">
                <button class="segbtn" data-act="inv-vatmode" data-mode="inc" aria-pressed="${inv.amountIncVat !== false}">inc VAT</button>
                <button class="segbtn" data-act="inv-vatmode" data-mode="ex" aria-pressed="${inv.amountIncVat === false}">ex VAT</button>
              </div></div>
          </div>
          <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin:2px 0 4px">
            <input type="checkbox" data-inv="vat"${inv.vat !== false ? " checked" : ""}> Charge VAT on this invoice</label>
        </div>
      </section>

      <section class="card">
        <div class="card-h"><h3>Totals</h3></div>
        <div class="card-b">
          <div id="inv-totals">${invoiceTotalsHtml(inv, state)}</div>
          <p style="font-size:12px;color:var(--muted);margin:12px 2px 0">
            Print gives you the branded invoice with your bank details. Set those in
            Settings → Invoice &amp; payment details.
          </p>
        </div>
      </section>
    </div>`;
}

export function invoiceTotalsHtml(inv, state) {
  const t = invoiceTotals(inv, vatPctFor(state));
  return `<div class="quote-out">
    <div class="qline"><span>${esc(inv.description || "Description")}</span><span>${money2(t.rate ? t.net : t.total)}</span></div>
    <div class="qline sub"><span>Subtotal</span><span>${money2(t.net)}</span></div>
    ${t.rate ? `<div class="qline muted"><span>VAT ${t.rate.toFixed(2)}%</span><span>${money2(t.vat)}</span></div>` : ""}
    <div class="qline tot"><span>Total due</span><span>${money2(t.total)}</span></div>
  </div>`;
}
