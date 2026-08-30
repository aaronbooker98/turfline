// A standalone, printable invoice in Yate Artificial Grass's house format.
// Opened in its own window (no app CSS), carries all its own styling. Print to
// PDF from the browser dialog.
import { esc, money2, parseISO } from "../util.js";
import { invoiceTotals } from "../model.js";

const ddmmyyyy = (iso) => {
  const d = parseISO(iso);
  if (!d) return "—";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export function buildInvoiceDoc(inv, state, { logoUrl } = {}) {
  const b = state.business;
  const t = invoiceTotals(inv, b.vat ? state.rates.vatPct : 0);
  const billTo = [inv.billTo?.name, inv.billTo?.address].filter(Boolean).join("\n");
  const fromLines = [b.legalName || b.name, b.address, b.email].filter(Boolean).map(esc).join("<br>");

  const payLines = [
    "PAYMENT MADE TO",
    esc(b.legalName || b.name || ""),
    esc(b.bankName || ""),
    [b.sortCode ? `SORT CODE: ${esc(b.sortCode)}` : "", b.invoiceFoot ? `/${esc(b.invoiceFoot)}` : ""].filter(Boolean).join("  "),
    b.accountNo ? `ACCOUNT NO: ${esc(b.accountNo)}` : ""
  ].filter(Boolean);

  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<title>Invoice ${esc(String(inv.number ?? ""))} — ${esc(inv.billTo?.name || "customer")}</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{font:14px/1.6 -apple-system,"Helvetica Neue",Arial,sans-serif;color:#1b1b1b;background:#fff}
  .sheet{max-width:760px;margin:0 auto;padding:0 0 50px}
  .band{padding:26px 32px 18px;display:flex;align-items:flex-start;justify-content:space-between;gap:24px;border-bottom:2px solid #161616}
  .band img{height:80px;width:auto;display:block}
  .band .name{font-weight:700;font-size:22px;letter-spacing:.02em}
  .band .from{font-size:12px;color:#666;text-align:right;line-height:1.7}
  .body{padding:24px 32px}
  .to{white-space:pre-line;margin-bottom:22px}
  .to .lbl{color:#888;font-size:12px;margin-bottom:2px}
  .meta{font-size:13px;margin-bottom:22px;line-height:1.9}
  .meta b{display:inline-block;min-width:130px;color:#555;font-weight:400}
  table{width:100%;border-collapse:collapse;margin-bottom:6px}
  th{text-align:left;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#fff;background:#8bbf6a;padding:9px 12px}
  th.r,td.r{text-align:right;font-variant-numeric:tabular-nums}
  td{padding:11px 12px;border-bottom:1px solid #e7e7e7;vertical-align:top}
  tr.spacer td{height:26px;border-bottom:1px solid #e7e7e7;background:#f3f7ef}
  tr.sub td{border-bottom:0;padding-top:12px;color:#444}
  tr.sub td.r,tr.vat td.r{font-weight:700}
  tr.vat td{border-bottom:0;padding:3px 12px;color:#555;font-size:13px}
  tr.tot td{border-bottom:0;border-top:2px solid #161616;padding-top:12px;font-size:17px;font-weight:700}
  .pay{margin-top:34px;font-size:13px;line-height:1.9}
  .pay .head{font-weight:700}
  .thanks{margin-top:26px;font-size:13px;color:#333}
  .vatno{margin-top:6px;font-size:12px;color:#777}
  .paid{display:inline-block;margin-left:12px;padding:3px 10px;border:2px solid #2e7d32;color:#2e7d32;border-radius:5px;font-size:12px;font-weight:700;transform:rotate(-4deg)}
  @media print{ .noprint{display:none} body{-webkit-print-color-adjust:exact;print-color-adjust:exact} }
  .noprint{position:fixed;top:12px;right:12px}
  .noprint button{font:600 13px/1 inherit;padding:9px 16px;border:0;border-radius:6px;background:#161616;color:#fff;cursor:pointer}
</style></head>
<body>
<div class="noprint"><button onclick="window.print()">Print / Save PDF</button></div>
<div class="sheet">
  <div class="band">
    ${logoUrl ? `<img src="${esc(logoUrl)}" alt="${esc(b.name)}">` : `<span class="name">${esc(b.name)}</span>`}
    <div class="from">${fromLines || ""}</div>
  </div>
  <div class="body">
    <div class="to"><div class="lbl">Attention:</div>${esc(billTo) || "—"}</div>

    <div class="meta">
      <div><b>Date:</b>${ddmmyyyy(inv.date)}</div>
      <div><b>Invoice Number:</b>${esc(String(inv.number ?? "—"))}${inv.paid ? `<span class="paid">PAID</span>` : ""}</div>
      <div><b>Terms:</b>${esc(b.invoiceTerms || "")}</div>
    </div>

    <table>
      <thead><tr><th>Description</th><th class="r">Cost</th></tr></thead>
      <tbody>
        <tr><td>${esc(inv.description || "")}</td><td class="r">${t.rate ? money2(t.net) : money2(t.total)}</td></tr>
        <tr class="spacer"><td colspan="2"></td></tr>
        <tr class="sub"><td>Subtotal</td><td class="r">${money2(t.net)}</td></tr>
        ${t.rate ? `<tr class="vat"><td>VAT ${t.rate.toFixed(2)}%</td><td class="r">${money2(t.vat)}</td></tr>` : ""}
        <tr class="tot"><td>TOTAL DUE</td><td class="r">${money2(t.total)}</td></tr>
      </tbody>
    </table>

    <div class="pay">${payLines.map((l, i) => `<div${i === 0 ? ' class="head"' : ""}>${l}</div>`).join("")}</div>

    <div class="thanks">Thank you for choosing ${esc(b.legalName || b.name)}.</div>
    ${b.vatNo ? `<div class="vatno">VAT NO: ${esc(b.vatNo)}</div>` : ""}
  </div>
</div>
</body></html>`;
}
