// Quote estimator — a quick ballpark price with no record created. Same cost
// stack as a real quote, but here the crew cost, days on site and margin are all
// editable per job, and you can work it the other way: type a £/m² price and it
// tells you the margin. Driven by a scratch `ui.est`; nothing is saved.
import { esc, num, money, money2 } from "../util.js";
import { quoteFor, estimateDays, aggregatesFor, sandBagsFor, WORKS } from "../model.js";

/** Area in m²: either typed straight in, or width × length. */
export function estArea(est) {
  return est.mode === "wl" ? num(est.w) * num(est.l) : num(est.area);
}

/** Fallback crew day rate = per-m² labour × crew output (≈ £420 by default). */
export const defaultCrewDayRate = (rates) => (num(rates.labour) * num(rates.m2PerCrewDay)) || 420;

/** A throwaway lead the pricing engine can read (for the cost side only). */
function estLead(est, rates) {
  const area = estArea(est);
  const days = num(est.days) || estimateDays(area, rates);
  const survey = {
    areaM2: area,
    grassSpec: est.grass || rates.grasses[0]?.name,
    crewDays: days,
    crewDayRate: num(est.crewDayRate) || defaultCrewDayRate(rates)
  };
  if (est.vanMode === "mileage") {
    const one = num(est.siteMiles);
    const vans = num(est.vans) || 2;
    const rate = num(est.mileageRate) || num(rates.mileageRate, 0.55);
    survey.vanCost = one * 2 * vans * days * rate;
    survey.vanNote = `${(one * 2).toFixed(0)} mi round trip · ${vans} van${vans > 1 ? "s" : ""} · ${days} day${days > 1 ? "s" : ""} @ £${rate.toFixed(2)}/mi`;
  }
  for (const [key] of WORKS) if (est.off?.[key]) survey[key] = false;
  return { survey };
}

/** Work out cost, margin and price from the current `est`. */
function estimate(est, state) {
  const rates = state.rates;
  const area = estArea(est);
  const vatPct = state.business.vat ? num(rates.vatPct, 0) : 0;
  const days = num(est.days) || estimateDays(area, rates);
  const dayRate = num(est.crewDayRate) || defaultCrewDayRate(rates);

  // Cost side: reuse the pricing engine for its cost lines + total.
  const q = quoteFor(estLead(est, rates), rates, state.business.vat);
  const costLines = q.lines.filter((l) => l.grp === "cost");
  const cost = q.cost;
  const costPerM2 = area ? cost / area : 0;
  const agg = aggregatesFor(area, rates);

  const accessPct = num(est.accessPct);
  const priceMode = est.priceMode === "price";

  let marginPct, marginAmt, base;
  if (priceMode) {
    base = num(est.pricePerM2) * area;            // stated price, ex VAT, before access
    marginAmt = base - cost;
    marginPct = cost ? (marginAmt / cost) * 100 : 0;
  } else {
    marginPct = est.marginPct === "" || est.marginPct == null ? num(rates.marginPct, 0) : num(est.marginPct);
    marginAmt = cost * marginPct / 100;
    base = cost + marginAmt;
  }
  const access = base * accessPct / 100;
  const net = base + access;
  const vat = net * vatPct / 100;
  return {
    area, days, dayRate, cost, costPerM2, costLines, priceMode, agg, billable: q.billable,
    marginPct, marginAmt, accessPct, access, net, vat, total: net + vat, vatPct,
    pricePerM2: area ? net / area : 0
  };
}

/** The right-hand results panel — re-rendered on its own as inputs change. */
export function estimatorResults(ctx) {
  const { state, ui } = ctx;
  const est = ui.est;
  if (!(estArea(est) > 0)) {
    return `<div class="empty">Enter a size on the left to see the estimate.</div>`;
  }
  const e = estimate(est, state);
  const row = (label, amt, cls = "") => `<div class="qline${cls ? " " + cls : ""}"><span>${label}</span><span>${money2(amt)}</span></div>`;
  const loss = e.marginAmt < 0;

  return `
    <div class="est-headline">
      <div class="est-price">${money(e.total)}</div>
      <div class="est-note">${e.vatPct ? "inc VAT" : "no VAT"} · ${money2(e.pricePerM2)}/m² · ${e.days} day${e.days > 1 ? "s" : ""} on site</div>
      ${e.vatPct ? `<div class="est-note">${money2(e.net)} + VAT</div>` : ""}
    </div>

    <div class="est-margin${loss ? " loss" : ""}">
      <div><span class="k">Cost</span> ${money2(e.cost)} <span class="sub">(${money2(e.costPerM2)}/m²)</span></div>
      <div><span class="k">Margin</span> ${e.marginPct.toFixed(loss || e.priceMode ? 1 : 0)}% <span class="sub">= ${money2(e.marginAmt)} ${loss ? "LOSS" : "profit"}</span></div>
      ${e.priceMode ? `<div class="sub">from your ${money2(num(est.pricePerM2))}/m² price</div>` : ""}
    </div>

    <div class="quote-out">
      ${e.costLines.map((l) => `<div class="qline"><span>${esc(l.label)}${l.detail ? ` <span class="det">${esc(l.detail)}</span>` : ""}</span><span>${money2(l.amt)}</span></div>`).join("")}
      ${row("Cost", e.cost, "sub")}
      ${row(`Margin${e.priceMode ? " (worked out)" : ""} — ${e.marginPct.toFixed(loss || e.priceMode ? 1 : 0)}%`, e.marginAmt, loss ? "loss" : "")}
      ${e.access > 0.004 ? row(`Difficult access — ${e.accessPct}%`, e.access) : ""}
      ${row(`Net${e.vatPct ? " (ex VAT)" : ""}`, e.net, "sub")}
      ${e.vatPct ? row(`VAT @ ${e.vatPct}%`, e.vat, "muted") : ""}
      ${row("Total", e.total, "tot")}
      <div class="qline muted"><span>${e.area.toFixed(1)} m²${est.mode === "wl" ? ` (${num(est.w)} × ${num(est.l)} m)` : ""} · crew ${money2(e.dayRate)}/day × ${e.days}</span><span></span></div>
    </div>

    <div class="est-mats">
      <div class="lbl">Materials to order</div>
      <div class="mrow"><span>${esc(est.grass || state.rates.grasses[0]?.name || "Grass")}</span><span>${e.billable.toFixed(1)} m²</span></div>
      ${!est.off?.type1 ? `<div class="mrow"><span>Type 1 sub-base <span class="sub">${num(state.rates.type1Depth, 75)}mm</span></span><span>${e.agg.type1.toFixed(1)} t</span></div>` : ""}
      ${!est.off?.stoneDust ? `<div class="mrow"><span>Stone dust <span class="sub">${num(state.rates.stoneDustDepth, 25)}mm</span></span><span>${e.agg.stoneDust.toFixed(1)} t</span></div>` : ""}
      ${!est.off?.muckaway ? `<div class="mrow"><span>Muck-away <span class="sub">~${e.agg.digDepthMm}mm dig</span></span><span>${e.agg.muckaway.toFixed(1)} t</span></div>` : ""}
      ${!est.off?.sand ? `<div class="mrow"><span>Kiln-dried sand <span class="sub">1 bag / 4 m²</span></span><span>${sandBagsFor(e.area)} × 25kg</span></div>` : ""}
      ${!est.off?.edging ? `<div class="mrow"><span>Edging</span><span>~${Math.ceil(4 * Math.sqrt(e.area))} m</span></div>` : ""}
    </div>
    <p class="est-disclaim">Ballpark only — tonnages are estimates from the set depths, confirm on a site survey. Nothing here is saved.</p>`;
}

export function renderEstimator(ctx) {
  const { state, ui } = ctx;
  const est = ui.est;
  const area = estArea(est);
  const rates = state.rates;
  const seg = (act, val, cur, label) => `<button class="segbtn" data-act="${act}" data-mode="${val}" aria-pressed="${cur === val}">${label}</button>`;
  const numField = (key, label, attrs, ph = "0") =>
    `<div class="field"><label class="lbl">${label}</label>
      <input class="inp num" type="number" inputmode="decimal" data-est="${key}" value="${esc(est[key])}" placeholder="${esc(ph)}" ${attrs}></div>`;

  const sizeInputs = est.mode === "wl"
    ? `<div class="grid2">${numField("w", "Width (m)", 'step="0.1"')}${numField("l", "Length (m)", 'step="0.1"')}</div>`
    : numField("area", "Area (m²)", 'step="0.5"');

  const autoDays = area > 0 ? String(estimateDays(area, rates)) : "auto";

  const marginInput = est.priceMode === "price"
    ? numField("pricePerM2", "Your price £/m² (ex VAT)", 'step="0.5"', "0")
    : numField("marginPct", "Margin %", 'step="1"', String(num(rates.marginPct)));

  return `
    <div class="grid2 est-grid" style="align-items:start">
      <section class="card">
        <div class="card-h"><h3>The job</h3></div>
        <div class="card-b">
          <div class="segbtns" style="margin-bottom:12px">${seg("est-mode", "area", est.mode, "Area (m²)")}${seg("est-mode", "wl", est.mode, "Width × Length")}</div>
          ${sizeInputs}
          <div class="field"><label class="lbl">Grass</label>
            <select class="inp" data-est="grass">${rates.grasses.map((g) =>
              `<option value="${esc(g.name)}"${(est.grass || rates.grasses[0]?.name) === g.name ? " selected" : ""}>${esc(g.name)} — £${num(g.rate).toFixed(2)}/m²</option>`).join("")}</select></div>

          <label class="lbl">Crew — varies per job</label>
          <div class="grid2">
            ${numField("days", "Days on site", 'step="1" min="1"', autoDays)}
            ${numField("crewDayRate", "Crew £ per day", 'step="10"', String(defaultCrewDayRate(rates)))}
          </div>

          <label class="lbl" style="margin-top:4px">Vans &amp; fuel</label>
          <div class="segbtns" style="margin-bottom:10px">${seg("est-vanmode", "flat", est.vanMode || "flat", `Flat £${num(rates.vans).toFixed(2)}/m²`)}${seg("est-vanmode", "mileage", est.vanMode || "flat", "By mileage from Yate")}</div>
          ${est.vanMode === "mileage" ? `<div class="grid3">
            ${numField("siteMiles", "Miles from Yate (one way)", 'step="1"', "0")}
            ${numField("vans", "Vans", 'step="1"', "2")}
            ${numField("mileageRate", "£ per mile", 'step="0.01"', String(num(rates.mileageRate, 0.55)))}
          </div>
          <p style="font-size:11.5px;color:var(--muted);margin:-4px 2px 4px">Round trip (miles × 2) × vans × days on site × rate, spread across the m². HMRC rate is £0.55/mile.</p>` : ""}

          <label class="lbl" style="margin-top:4px">Margin</label>
          <div class="segbtns" style="margin-bottom:10px">${seg("est-pricemode", "margin", est.priceMode || "margin", "Set margin %")}${seg("est-pricemode", "price", est.priceMode || "margin", "Set £/m² price")}</div>
          ${marginInput}
          ${numField("accessPct", "Difficult access surcharge %", 'step="1"', "0")}

          <label class="lbl">Included in the job — untick anything not needed</label>
          <div class="checks">
            ${WORKS.map(([key, label]) =>
              `<label><input type="checkbox" data-est-work="${key}"${est.off?.[key] ? "" : " checked"}> ${esc(label)} <span class="est-rate">£${num(rates[key]).toFixed(2)}</span></label>`).join("")}
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn sm ghost" data-act="est-reset">Reset</button>
            ${area > 0 ? `<button class="btn sm" data-act="est-save">Save as a lead</button>` : ""}
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-h"><h3>Estimate</h3><span class="n">${state.business.vat ? "inc VAT" : "no VAT"}</span></div>
        <div class="card-b"><div id="est-out">${estimatorResults(ctx)}</div></div>
      </section>
    </div>`;
}
