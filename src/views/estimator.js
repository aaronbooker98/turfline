// Quote estimator — a quick ballpark price with no record created. Same maths as
// a real quote (per-m² cost stack → margin → VAT), driven by a scratch `ui.est`.
import { esc, num, money, money2 } from "../util.js";
import { quoteFor, WORKS } from "../model.js";
import { quoteRows } from "./drawer.js";

/** Area in m²: either typed straight in, or width × length. */
export function estArea(est) {
  return est.mode === "wl" ? num(est.w) * num(est.l) : num(est.area);
}

/** A throwaway lead the pricing engine can read. */
function estLead(est, rates) {
  const survey = {
    areaM2: estArea(est),
    grassSpec: est.grass || rates.grasses[0]?.name,
    accessPct: num(est.accessPct)
  };
  for (const [key] of WORKS) if (est.off?.[key]) survey[key] = false;
  return { survey };
}

/** The right-hand results panel — re-rendered on its own as inputs change. */
export function estimatorResults(ctx) {
  const { state, ui } = ctx;
  const area = estArea(ui.est);
  if (!(area > 0)) {
    return `<div class="empty">Enter a size on the left to see the estimate.</div>`;
  }
  const q = quoteFor(estLead(ui.est, state.rates), state.rates, state.business.vat);
  return `
    <div class="est-headline">
      <div class="est-price">${money(q.total)}</div>
      <div class="est-note">${q.vatPct ? "inc VAT" : "no VAT"} · ${money2(area ? q.total / area : 0)}/m² · about ${q.days} crew day${q.days > 1 ? "s" : ""}</div>
      ${q.vatPct ? `<div class="est-note">${money2(q.net)} + VAT</div>` : ""}
    </div>
    <div class="quote-out">${quoteRows(q, {
      footer: `<div class="qline muted"><span>${area.toFixed(1)} m²${ui.est.mode === "wl" ? ` (${num(ui.est.w)} × ${num(ui.est.l)} m)` : ""} · ${q.billable.toFixed(1)} m² grass to order</span><span></span></div>`
    })}</div>
    <p class="est-disclaim">Ballpark only — confirm on a site survey. Nothing here is saved.</p>`;
}

export function renderEstimator(ctx) {
  const { state, ui } = ctx;
  const est = ui.est;
  const seg = (val, label) => `<button class="segbtn" data-act="est-mode" data-mode="${val}" aria-pressed="${est.mode === val}">${label}</button>`;

  const sizeInputs = est.mode === "wl"
    ? `<div class="grid2">
        <div class="field"><label class="lbl">Width (m)</label>
          <input class="inp num" type="number" inputmode="decimal" step="0.1" data-est="w" value="${esc(est.w)}" placeholder="0"></div>
        <div class="field"><label class="lbl">Length (m)</label>
          <input class="inp num" type="number" inputmode="decimal" step="0.1" data-est="l" value="${esc(est.l)}" placeholder="0"></div>
      </div>`
    : `<div class="field"><label class="lbl">Area (m²)</label>
        <input class="inp num" type="number" inputmode="decimal" step="0.5" data-est="area" value="${esc(est.area)}" placeholder="0"></div>`;

  return `
    <div class="grid2 est-grid" style="align-items:start">
      <section class="card">
        <div class="card-h"><h3>The job</h3></div>
        <div class="card-b">
          <div class="segbtns" style="margin-bottom:12px">${seg("area", "Area (m²)")}${seg("wl", "Width × Length")}</div>
          ${sizeInputs}
          <div class="field"><label class="lbl">Grass</label>
            <select class="inp" data-est="grass">${state.rates.grasses.map((g) =>
              `<option value="${esc(g.name)}"${(est.grass || state.rates.grasses[0]?.name) === g.name ? " selected" : ""}>${esc(g.name)} — £${num(g.rate).toFixed(2)}/m²</option>`).join("")}</select></div>
          <div class="field"><label class="lbl">Difficult access surcharge %</label>
            <input class="inp num" type="number" inputmode="numeric" step="1" data-est="accessPct" value="${esc(est.accessPct)}" placeholder="0"></div>

          <label class="lbl">Included in the job — untick anything not needed</label>
          <div class="checks">
            ${WORKS.map(([key, label]) =>
              `<label><input type="checkbox" data-est-work="${key}"${est.off?.[key] ? "" : " checked"}> ${esc(label)} <span class="est-rate">£${num(state.rates[key]).toFixed(2)}</span></label>`).join("")}
          </div>

          <button class="btn sm ghost" data-act="est-reset">Reset</button>
        </div>
      </section>

      <section class="card">
        <div class="card-h"><h3>Estimate</h3><span class="n">margin ${num(state.rates.marginPct)}%</span></div>
        <div class="card-b"><div id="est-out">${estimatorResults(ctx)}</div></div>
      </section>
    </div>`;
}
