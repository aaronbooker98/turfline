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
  return `<div class="grid2" style="align-items:start">
    <section class="card">
      <div class="card-h"><h3>Pricing</h3><span class="n">used by every quote</span></div>
      <div class="card-b">
        <div class="lbl">Grass rates (£ per m²)</div>
        ${r.grasses.map((g, i) => `<div class="settrow">
          <input class="inp" data-grass-name="${i}" value="${esc(g.name)}">
          <input class="inp num" type="number" step="0.01" data-grass-rate="${i}" value="${esc(g.rate)}"></div>`).join("")}
        <div style="margin:10px 0 18px"><button class="btn sm" data-act="add-grass">${icon("plus")}Add a grass</button></div>
        ${rateRow(r, "subBase", "Sub-base & prep", "£ per m² — dig out, MOT type 1, grano, compaction")}
        ${rateRow(r, "labour", "Installation labour", "£ per m²")}
        ${rateRow(r, "membrane", "Weed membrane", "£ per m²")}
        ${rateRow(r, "sand", "Silica sand infill", "£ per m²")}
        ${rateRow(r, "edging", "Timber edging", "£ per linear m")}
        ${rateRow(r, "skip", "Skip hire", "£ per job", "1")}
        ${rateRow(r, "wastePct", "Default waste", "% added to the grass ordered", "1")}
        ${rateRow(r, "vatPct", "VAT", "%", "1")}
        ${rateRow(r, "m2PerCrewDay", "Crew output", "m² per crew per day — sets job length", "1")}
      </div>
    </section>
    <div style="display:flex;flex-direction:column;gap:16px">
      <section class="card"><div class="card-h"><h3>Business</h3></div><div class="card-b">
        <div class="field"><label class="lbl" for="bizname">Trading name</label>
          <input class="inp" id="bizname" data-biz="name" value="${esc(state.business.name)}"></div>
        <label style="display:flex;gap:8px;align-items:center;font-size:13px">
          <input type="checkbox" data-biz="vat"${state.business.vat ? " checked" : ""}> VAT registered — add VAT to quotes</label>
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
