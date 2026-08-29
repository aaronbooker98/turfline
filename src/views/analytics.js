// The whole business at a glance: funnel, win rate, money and where it comes from.
import { esc, money } from "../util.js";
import { overview } from "../analytics.js";
import { icon } from "../icons.js";

const pct = (n) => `${Math.round(n * 100)}%`;

const tile = (value, key, meta, cls = "") => `
  <div class="tile ${cls}"><span class="stripe"></span>
    <div class="k">${esc(key)}</div><div class="v">${esc(String(value))}</div><div class="m">${esc(meta)}</div>
  </div>`;

export function renderAnalytics(ctx) {
  const { state } = ctx;
  if (!state.leads.length) {
    return `<div class="card"><div class="empty" style="padding:56px 20px">
      <strong>No data to chart yet</strong>
      Add some enquiries and this fills in.
    </div></div>`;
  }

  const o = overview(state);
  const maxMonthRev = Math.max(1, ...o.byMonth.map((m) => m.revenue));
  const maxSource = Math.max(1, ...o.bySource.map((s) => s.leads));

  return `
    <div class="tiles">
      ${tile(money(o.wonValue), "Revenue won", `${o.wonCount} job${o.wonCount === 1 ? "" : "s"} all time`)}
      ${tile(money(o.pipelineValue), "Open pipeline", `${money(o.weightedPipeline)} weighted · ${o.openLeads} live`)}
      ${tile(pct(o.winRate.rate), "Win rate", `${o.winRate.won} won / ${o.winRate.lost} lost`)}
      ${tile(money(o.avgDealSize), "Average job", o.avgDaysToClose != null ? `${o.avgDaysToClose} days to close` : "—")}
      ${tile(money(o.wonThisMonthValue), "Won this month", `${o.wonThisMonthCount} job${o.wonThisMonthCount === 1 ? "" : "s"}`)}
      ${tile(money(o.moneyOwed), "Money owed", "across won & installed jobs", o.moneyOwed > 0 ? "alert" : "")}
      ${tile(o.coldQuotes, "Cold quotes", `${money(o.coldValue)} going stale`, o.coldQuotes ? "alert" : "")}
    </div>

    <div class="an-grid">
      <section class="card">
        <div class="card-h"><h3>Conversion funnel</h3><span class="n">enquiry → won</span></div>
        <div class="card-b">
          <div class="funnel">${o.funnel.map((s, i) => `
            <div class="fstep">
              <div class="fbar" style="width:${Math.max(6, s.ofStart * 100)}%">
                <span class="fl">${esc(s.label)}</span><span class="fn">${s.count}</span>
              </div>
              ${i > 0 ? `<span class="fdrop">${pct(s.fromPrev)} through</span>` : `<span class="fdrop">&nbsp;</span>`}
            </div>`).join("")}
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-h"><h3>Revenue by month</h3><span class="n">last 6 months</span></div>
        <div class="card-b">
          <div class="mbars">${o.byMonth.map((m) => `
            <div class="mbar">
              <div class="mtrack"><div class="mfill" style="height:${Math.round((m.revenue / maxMonthRev) * 100)}%"></div></div>
              <div class="mval">${m.revenue ? money(m.revenue) : "—"}</div>
              <div class="mlab">${esc(m.label)}</div>
              <div class="mmeta">${m.won} won · ${m.leads} in</div>
            </div>`).join("")}
          </div>
        </div>
      </section>

      ${o.lostReasons.length ? `<section class="card an-wide">
        <div class="card-h"><h3>Why deals are lost</h3><span class="n">${o.winRate.lost} lost</span></div>
        <div class="card-b">
          <div class="lostbars">${(() => {
            const max = Math.max(1, ...o.lostReasons.map((r) => r.count));
            return o.lostReasons.map((r) => `<div class="lostrow">
              <span class="ll">${esc(r.reason)}</span>
              <span class="lt"><span style="width:${Math.round((r.count / max) * 100)}%"></span></span>
              <span class="lc">${r.count}</span></div>`).join("");
          })()}</div>
        </div>
      </section>` : ""}

      <section class="card an-wide">
        <div class="card-h"><h3>Lead sources</h3><span class="n">${o.bySource.length} channels</span></div>
        <div class="card-b flush">
          <table class="ltable">
            <thead><tr><th>Source</th><th class="r">Leads</th><th class="r">Won</th><th class="r">Win rate</th><th class="r">Revenue</th><th class="r">Open</th></tr></thead>
            <tbody>${o.bySource.map((s) => `<tr>
              <td>
                <div class="lt-name">${esc(s.source)}</div>
                <div class="srcbar"><span style="width:${Math.round((s.leads / maxSource) * 100)}%"></span></div>
              </td>
              <td class="r num">${s.leads}</td>
              <td class="r num">${s.won}</td>
              <td class="r num">${s.won + s.lost ? pct(s.winRate) : "<span class='lt-dim'>—</span>"}</td>
              <td class="r num">${s.revenue ? money(s.revenue) : "<span class='lt-dim'>—</span>"}</td>
              <td class="r num lt-dim">${s.pipeline ? money(s.pipeline) : "—"}</td>
            </tr>`).join("")}</tbody>
          </table>
        </div>
      </section>
    </div>
    <p class="an-foot">${icon("analytics", "")} Figures use the current quote for each record and your rates in Settings. Weighted pipeline discounts each live lead by how likely that stage is to close.</p>`;
}
