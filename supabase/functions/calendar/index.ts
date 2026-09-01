// Turfline calendar feed.
// Outputs an iCalendar (.ics) feed of every booked survey and every install, so
// the office can subscribe to it in Google / Apple Calendar.
//
// Deploy in the Supabase dashboard: Edge Functions -> Create function -> name it
// "calendar" -> paste this file -> turn OFF "Verify JWT" -> Deploy.
// Then add a secret CALENDAR_TOKEN (see supabase/DEPLOY-CALENDAR.md).
//
// Feed URL:
//   https://<project>.functions.supabase.co/calendar?token=<CALENDAR_TOKEN>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN = Deno.env.get("CALENDAR_TOKEN") ?? "";

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const pad = (n: number) => String(n).padStart(2, "0");
const stampUTC = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const dateOnly = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
const addDays = (iso: string, n: number) => {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
};
const esc = (s: string) =>
  String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (line: string) => {
  // iCal: split lines longer than 75 octets, continuation begins with a space
  const out: string[] = [];
  let s = line;
  while (s.length > 74) { out.push(s.slice(0, 74)); s = " " + s.slice(74); }
  out.push(s);
  return out.join("\r\n");
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (!TOKEN || url.searchParams.get("token") !== TOKEN) {
    return new Response("forbidden", { status: 403 });
  }

  const { data, error } = await db.from("leads").select("id,data");
  if (error) return new Response(error.message, { status: 500 });

  const now = stampUTC(new Date());
  const ev: string[] = [];
  const push = (parts: Record<string, string>) => {
    ev.push("BEGIN:VEVENT");
    for (const [k, v] of Object.entries(parts)) if (v) ev.push(fold(`${k}:${v}`));
    ev.push(`DTSTAMP:${now}`);
    ev.push("END:VEVENT");
  };

  for (const row of data ?? []) {
    const l = row.data as Record<string, any>;
    const who = l.name || "Enquiry";
    const place = [l.address, l.postcode].filter(Boolean).join(", ");
    const stage = l.stage;

    // Booked survey
    const bf: string = l.survey?.bookedFor || "";
    if (bf && (stage === "enquiry" || stage === "survey")) {
      const timed = /T\d{2}:\d{2}/.test(bf);
      const base: Record<string, string> = {
        UID: `survey-${row.id}@turfline`,
        SUMMARY: esc(`Survey: ${who}`),
        LOCATION: esc(place),
        DESCRIPTION: esc([l.phone, l.survey?.bookedNote].filter(Boolean).join(" · "))
      };
      if (timed) {
        const start = bf.slice(0, 16).replace(/[-:]/g, "");
        const end = new Date(bf.slice(0, 16) + ":00");
        end.setHours(end.getHours() + 1);
        base["DTSTART"] = `${start}00`;
        base["DTEND"] = `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
      } else {
        base["DTSTART;VALUE=DATE"] = dateOnly(bf);
        base["DTEND;VALUE=DATE"] = addDays(bf, 1);
      }
      push(base);
    }

    // Install
    const sd: string = l.job?.startDate || "";
    if (sd && l.job?.status !== "complete") {
      const days = Math.max(1, Number(l.job?.days) || 1);
      push({
        UID: `install-${row.id}@turfline`,
        "DTSTART;VALUE=DATE": dateOnly(sd),
        "DTEND;VALUE=DATE": addDays(sd, days),
        SUMMARY: esc(`Install: ${who}${days > 1 ? ` (${days} days)` : ""}`),
        LOCATION: esc(place),
        DESCRIPTION: esc([l.survey?.areaM2 ? `${l.survey.areaM2} m²` : "", l.phone].filter(Boolean).join(" · "))
      });
    }
  }

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Turfline//Yate Artificial Grass//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Yate Artificial Grass",
    "X-WR-TIMEZONE:Europe/London",
    ...ev,
    "END:VCALENDAR"
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="yate-artificial-grass.ics"',
      "cache-control": "public, max-age=900"
    }
  });
});
