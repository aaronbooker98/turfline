// Rates, crews and data management. Editing a rate re-prices every quote.
import { esc } from "../util.js";
import { icon } from "../icons.js";

const rateRow = (rates, key, label, help, step = "0.01") => `
  <div class="settrow">
    <div class="d">${esc(label)}<small>${esc(help)}</small></div>
    <input class="inp num" type="number" step="${step}" data-rate="${key}" value="${esc(rates[key])}">
  </div>`;

export function renderSettings(ctx) {
  const { state } = ctx;
  const r = state.rates;
  const b = state.business;
  return `<div class="grid2" style="align-items:start">
    <section class="card">
      <div class="card-h"><h3>Pricing</h3><span class="n">used by every quote</span></div>
      <div class="card-b">
        <div class="lbl">Grass rates (£ per m²)</div>
        ${r.grasses.map((g, i) => `<div class="settrow">
          <input class="inp" data-grass-name="${i}" value="${esc(g.name)}">
          <input class="inp num" type="number" step="0.01" data-grass-rate="${i}" value="${esc(g.rate)}"></div>`).join("")}
        <div style="margin:10px 0 18px"><button class="btn sm" data-act="add-grass">${icon("plus")}Add a grass</button></div>
        <div class="lbl">Groundworks & materials (£ per m²)</div>
        ${rateRow(r, "type1", "Type 1 sub-base", "75mm")}
        ${rateRow(r, "stoneDust", "Stone dust blinding", "25mm")}
        ${rateRow(r, "muckaway", "Excavate & cart waste away", "muck-away")}
        ${rateRow(r, "membrane", "Weed membrane", "")}
        ${rateRow(r, "sand", "Sand infill", "kiln-dried")}
        ${rateRow(r, "joins", "Joining tape & glue", "")}
        ${rateRow(r, "edging", "Edging", "")}
        ${rateRow(r, "type1Depth", "Type 1 depth", "mm — sets the tonnage estimate", "5")}
        ${rateRow(r, "stoneDustDepth", "Stone dust depth", "mm", "5")}
        ${rateRow(r, "muckawayDepth", "Muck-away dig depth", "mm — total dig-out, sets the muck-away tonnage", "5")}
        <div class="lbl" style="margin-top:14px">Labour & running costs (£ per m²)</div>
        ${rateRow(r, "labour", "Crew labour", "£420 crew day / 40 m²")}
        ${rateRow(r, "vans", "Vans / fuel", "")}
        ${rateRow(r, "sundries", "Sundries", "")}
        <div class="lbl" style="margin-top:14px">Margin, VAT & output</div>
        ${rateRow(r, "marginPct", "Margin", "% added to cost to get the price (ex VAT)", "1")}
        ${rateRow(r, "vatPct", "VAT", "%", "1")}
        ${rateRow(r, "wastePct", "Grass waste allowance", "% extra grass ordered for cuts", "1")}
        ${rateRow(r, "m2PerCrewDay", "Crew output", "m² per crew per day — sets job length", "1")}
      </div>
    </section>
    <div style="display:flex;flex-direction:column;gap:16px">
      <section class="card"><div class="card-h"><h3>Business</h3><span class="n">shown on quotes</span></div><div class="card-b">
        <div class="field"><label class="lbl">Trading name</label>
          <input class="inp" data-biz="name" value="${esc(b.name ?? "")}"></div>
        <div class="grid2">
          <div class="field"><label class="lbl">Phone</label><input class="inp" data-biz="phone" value="${esc(b.phone ?? "")}"></div>
          <div class="field"><label class="lbl">Email</label><input class="inp" type="email" data-biz="email" value="${esc(b.email ?? "")}"></div>
        </div>
        <div class="field"><label class="lbl">Address</label><input class="inp" data-biz="address" value="${esc(b.address ?? "")}" placeholder="Unit 1, … , Yate"></div>
        <div class="grid2">
          <div class="field"><label class="lbl">Company / VAT reg no.</label><input class="inp" data-biz="regNo" value="${esc(b.regNo ?? "")}"></div>
          <div class="field"><label class="lbl">Quote valid (days)</label><input class="inp num" type="number" step="1" data-biz="quoteValidDays" value="${esc(b.quoteValidDays ?? 30)}"></div>
        </div>
        <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin:2px 0 12px">
          <input type="checkbox" data-biz="vat"${b.vat ? " checked" : ""}> VAT registered — add VAT to quotes</label>
        <div class="field"><label class="lbl">Quote terms &amp; conditions</label>
          <textarea class="inp" data-biz="quoteTerms" rows="4">${esc(b.quoteTerms ?? "")}</textarea></div>
      </div></section>
      <section class="card"><div class="card-h"><h3>Invoice &amp; payment details</h3><span class="n">shown on invoices</span></div><div class="card-b">
        <div class="field"><label class="lbl">Legal / company name</label>
          <input class="inp" data-biz="legalName" value="${esc(b.legalName ?? "")}" placeholder="Yate Artificial Grass Ltd"></div>
        <div class="grid2">
          <div class="field"><label class="lbl">Bank</label><input class="inp" data-biz="bankName" value="${esc(b.bankName ?? "")}"></div>
          <div class="field"><label class="lbl">VAT number</label><input class="inp" data-biz="vatNo" value="${esc(b.vatNo ?? "")}"></div>
        </div>
        <div class="grid2">
          <div class="field"><label class="lbl">Sort code</label><input class="inp" data-biz="sortCode" value="${esc(b.sortCode ?? "")}" placeholder="30-99-50"></div>
          <div class="field"><label class="lbl">Account number</label><input class="inp" data-biz="accountNo" value="${esc(b.accountNo ?? "")}"></div>
        </div>
        <div class="grid2">
          <div class="field"><label class="lbl">Invoice terms line</label><input class="inp" data-biz="invoiceTerms" value="${esc(b.invoiceTerms ?? "")}"></div>
          <div class="field"><label class="lbl">Next invoice number</label><input class="inp num" type="number" step="1" data-biz="nextInvoiceNo" value="${esc(b.nextInvoiceNo ?? 261)}"></div>
        </div>
        <div class="field"><label class="lbl">Payment note</label><input class="inp" data-biz="invoiceFoot" value="${esc(b.invoiceFoot ?? "")}" placeholder="OR CASH + CHEQUE ACCEPTED"></div>
      </div></section>
      <section class="card"><div class="card-h"><h3>Crews</h3><span class="n">${state.crews.length}</span></div><div class="card-b">
        ${state.crews.map((c, i) => `<div class="crewrow">
          <span class="crewdot" style="background:${esc(c.colour)}"></span>
          <input class="inp" data-crew="${i}" value="${esc(c.name)}" style="flex:1">
          <button class="btn sm ghost danger" data-act="del-crew" data-i="${i}" aria-label="Remove ${esc(c.name)}">${icon("x")}</button>
        </div>`).join("")}
        <div style="margin-top:10px"><button class="btn sm" data-act="add-crew">${icon("plus")}Add crew</button></div>
      </div></section>
      <section class="card"><div class="card-h"><h3>Your data</h3></div><div class="card-b">
        <p style="margin:0 0 12px;font-size:13px;color:var(--muted)">${state.leads.length} records in the shared database. Export writes a JSON backup file — keep one somewhere safe.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn sm" data-act="export">Export backup</button>
          <button class="btn sm" data-act="import">Import a backup</button>
        </div>
      </div></section>
    </div>
  </div>`;
}
