// A standalone, printable quote. Opened in its own window (no app CSS), so it
// carries all its own styling inline. Print to PDF from the browser dialog.
import { esc, money2, parseISO } from "../util.js";
import { quoteFor } from "../model.js";

const longDate = (iso) =>
  parseISO(iso)?.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) ?? "—";

export function buildQuoteDoc(lead, state, { logoUrl } = {}) {
  const b = state.business;
  const q = quoteFor(lead, state.rates, b.vat);
  const ref = lead.quote?.ref || "—";
  const today = new Date().toISOString().slice(0, 10);
  const dated = lead.quote?.docDate || today;
  const validDays = Number(b.quoteValidDays) || 30;

  const line = (l) => `<tr><td>${esc(l.label)}${l.detail ? `<span class="d">${esc(l.detail)}</span>` : ""}</td>
    <td class="r">${money2(l.amt)}</td></tr>`;

  const custBits = [lead.name, lead.address, lead.postcode].filter(Boolean).map(esc).join("<br>");
  const bizContact = [b.phone, b.email].filter(Boolean).map(esc).join(" &nbsp;·&nbsp; ");
  const bizFoot = [b.address, b.regNo && `Reg: ${b.regNo}`, b.vat && b.regNo && ""].filter(Boolean).map(esc).join(" &nbsp;·&nbsp; ");

  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<title>Quote ${esc(ref)} — ${esc(lead.name || "customer")}</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{font:14px/1.5 -apple-system,"Helvetica Neue",Arial,sans-serif;color:#1b1b1b;background:#fff}
  .sheet{max-width:760px;margin:0 auto;padding:0 0 40px}
  .band{background:#161616;color:#fff;padding:22px 32px;display:flex;align-items:center;justify-content:space-between;gap:20px}
  .band img{height:64px;width:auto;display:block}
  .band .name{font-weight:700;font-size:20px;letter-spacing:.02em}
  .band .contact{font-size:12px;color:#cfcfcf;text-align:right;line-height:1.7}
  .body{padding:28px 32px}
  h1{font-size:22px;margin:0 0 4px}
  .meta{color:#666;font-size:12.5px;margin-bottom:24px}
  .parties{display:flex;gap:40px;margin-bottom:26px}
  .parties h2{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#888;margin:0 0 6px}
  table{width:100%;border-collapse:collapse;margin-bottom:6px}
  th{text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#888;border-bottom:2px solid #161616;padding:0 0 7px}
  th.r,td.r{text-align:right;font-variant-numeric:tabular-nums}
  td{padding:9px 0;border-bottom:1px solid #e7e7e7;vertical-align:top}
  td .d{display:block;color:#888;font-size:11.5px;margin-top:2px}
  tr.sub td{border-bottom:0;padding-top:12px;color:#444}
  tr.vat td{border-bottom:0;padding:3px 0;color:#666;font-size:12.5px}
  tr.tot td{border-bottom:0;border-top:2px solid #161616;padding-top:12px;font-size:18px;font-weight:700}
  .spec{background:#f5f5f2;border-radius:8px;padding:14px 16px;font-size:13px;margin:22px 0}
  .spec b{display:inline-block;min-width:130px;color:#555}
  .terms{font-size:12px;color:#555;border-top:1px solid #e7e7e7;padding-top:16px;margin-top:26px;white-space:pre-wrap}
  .foot{font-size:11px;color:#999;text-align:center;margin-top:26px}
  @media print{ .noprint{display:none} body{-webkit-print-color-adjust:exact;print-color-adjust:exact} }
  .noprint{position:fixed;top:12px;right:12px}
  .noprint button{font:600 13px/1 inherit;padding:9px 16px;border:0;border-radius:6px;background:#161616;color:#fff;cursor:pointer}
</style></head>
<body>
<div class="noprint"><button onclick="window.print()">Print / Save PDF</button></div>
<div class="sheet">
  <div class="band">
    ${logoUrl ? `<img src="${esc(logoUrl)}" alt="${esc(b.name)}">` : `<span class="name">${esc(b.name)}</span>`}
    <div class="contact">${bizContact || ""}</div>
  </div>
  <div class="body">
    <h1>Quotation</h1>
    <div class="meta">Ref ${esc(ref)} &nbsp;·&nbsp; ${esc(longDate(dated))} &nbsp;·&nbsp; valid ${validDays} days</div>

    <div class="parties">
      <div><h2>For</h2>${custBits || "—"}</div>
      <div><h2>From</h2>${esc(b.name)}${b.address ? `<br>${esc(b.address)}` : ""}</div>
    </div>

    <table>
      <thead><tr><th>Item</th><th class="r">Amount</th></tr></thead>
      <tbody>
        ${q.custLines.map(line).join("")}
        <tr class="sub"><td>Net${b.vat ? " (ex VAT)" : ""}</td><td class="r">${money2(q.net)}</td></tr>
        ${q.vatPct ? `<tr class="vat"><td>VAT @ ${q.vatPct}%</td><td class="r">${money2(q.vat)}</td></tr>` : ""}
        <tr class="tot"><td>Total${b.vat ? " (inc VAT)" : ""}</td><td class="r">${money2(q.total)}</td></tr>
      </tbody>
    </table>

    <div class="spec">
      <div><b>Area</b>${q.area} m²</div>
      <div><b>Grass</b>${esc(q.grass.name)}</div>
      <div><b>On site</b>about ${q.days} working day${q.days > 1 ? "s" : ""}</div>
      ${lead.survey?.notes ? `<div style="margin-top:8px"><b>Notes</b>${esc(lead.survey.notes)}</div>` : ""}
    </div>

    <div class="terms">${esc(b.quoteTerms || "")}</div>
    <div class="foot">${bizFoot || esc(b.name)}</div>
  </div>
</div>
</body></html>`;
}
