// Survey diary — every booked "go and measure up" appointment, soonest first,
// grouped by day. Bookings live on the lead (survey.bookedFor); set one in the
// record's Survey section.
import { esc, todayISO, addDays, fmtDateLong } from "../util.js";
import { bookedSurveys, stage, leadName } from "../model.js";
import { icon } from "../icons.js";

const timeOf = (when) => {
  const s = String(when || "");
  const m = s.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "";
};

const dayHeading = (day, today) => {
  if (day === today) return "Today";
  if (day === addDays(today, 1)) return "Tomorrow";
  return fmtDateLong(day);
};

function surveyRow(entry) {
  const l = entry.lead;
  const t = timeOf(entry.when);
  const bits = [l.postcode || l.address, l.phone].filter(Boolean).map(esc).join(" · ");
  return `<div class="qrow" data-open="${l.id}">
    <span class="qmark ${entry.overdue ? "crit" : ""}"></span>
    <div class="qmain">
      <div class="qname">${t ? `<span class="svtime">${esc(t)}</span> ` : ""}${esc(leadName(l))}</div>
      <div class="qmeta">${bits || esc(stage(l.stage).label)}${l.survey?.bookedNote ? ` — ${esc(l.survey.bookedNote)}` : ""}</div>
    </div>
    <div class="qright">${entry.overdue ? `<span class="pill crit"><span class="pdot"></span>write up</span>` : ""}</div>
  </div>`;
}

export function renderSurveys(ctx) {
  const { state } = ctx;
  const today = todayISO();
  const all = bookedSurveys(state.leads, today);

  if (!all.length) {
    return `<div class="card"><div class="empty" style="padding:52px 20px">
      <strong>No surveys booked</strong>
      Open an enquiry, set a date in the <b>Survey</b> section, and it lands here.
    </div></div>`;
  }

  const overdue = all.filter((e) => e.overdue);
  const upcoming = all.filter((e) => !e.overdue);

  // group upcoming by day
  const groups = [];
  for (const e of upcoming) {
    let g = groups.find((x) => x.day === e.day);
    if (!g) { g = { day: e.day, items: [] }; groups.push(g); }
    g.items.push(e);
  }

  return `
    ${overdue.length ? `<div class="banner warn">${icon("alert")}<div><strong>${overdue.length} survey${overdue.length > 1 ? "s" : ""} to write up.</strong> The appointment's been and gone — mark them Surveyed and get the quote out.</div></div>` : ""}
    <div class="two-col">
      <div style="display:flex;flex-direction:column;gap:16px">
        ${overdue.length ? `<section class="card"><div class="card-h"><h3>Needs writing up</h3><span class="n">${overdue.length}</span></div>
          <div class="card-b flush"><div class="queue">${overdue.map(surveyRow).join("")}</div></div></section>` : ""}
        <section class="card"><div class="card-h"><h3>Diary</h3><span class="n">${upcoming.length} booked</span></div>
          <div class="card-b flush">
            ${groups.length ? groups.map((g) => `
              <div class="sv-day">${esc(dayHeading(g.day, today))}</div>
              <div class="queue">${g.items.map(surveyRow).join("")}</div>`).join("")
              : `<div class="empty">Nothing coming up.</div>`}
          </div></section>
      </div>
      <section class="card"><div class="card-h"><h3>How it works</h3></div><div class="card-b">
        <p style="font-size:13px;color:var(--muted);line-height:1.6;margin:0">
          Booking a survey: open the enquiry → <b>Survey</b> section → set <b>Survey booked for</b>
          (date &amp; time). The stage moves to <b>Survey booked</b> automatically and it appears
          in this diary. After you've been, set the area and mark the record <b>Surveyed</b> and
          it drops off here.
        </p>
      </div></section>
    </div>`;
}
