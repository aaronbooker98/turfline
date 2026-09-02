// Turfline MCP server — lets Claude (phone or web, as a Custom Connector) read
// and update the CRM: find leads, book surveys, check the diary, add to-dos, etc.
//
// Deploy in the Supabase dashboard: Edge Functions -> Create function -> name it
// "mcp" -> paste this file -> turn OFF "Verify JWT" -> Deploy.
// Then add a secret MCP_KEY (a long random string) under Edge Functions -> Secrets.
//
// Connector URL to paste into Claude (Customize -> Connectors -> Add custom connector):
//   https://<project>.supabase.co/functions/v1/mcp?key=<MCP_KEY>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KEY = Deno.env.get("MCP_KEY") ?? "";

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (base: string, n: number) => {
  const d = new Date(base + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const stamp = () => new Date().toISOString();

const CHASE: Record<string, number> = { enquiry: 1, survey: 0, surveyed: 1, quoted: 4, won: 0, installed: 14, lost: 0 };
const STAGE_LABEL: Record<string, string> = {
  enquiry: "Enquiry", survey: "Survey booked", surveyed: "Surveyed",
  quoted: "Quoted", won: "Won", installed: "Installed", lost: "Lost"
};

function setStage(data: any, id: string) {
  if (!STAGE_LABEL[id] || data.stage === id) return;
  const from = STAGE_LABEL[data.stage] ?? data.stage;
  data.stage = id;
  data.stageAt = todayISO();
  if (CHASE[id] > 0) data.nextAction = addDaysISO(todayISO(), CHASE[id]);
  else if (id === "won" || id === "lost") data.nextAction = null;
  logActivity(data, `Stage: ${from} -> ${STAGE_LABEL[id]}`);
}
function logActivity(data: any, text: string) {
  data.activity ??= [];
  data.activity.unshift({ ts: stamp(), text });
  if (data.activity.length > 60) data.activity.length = 60;
}

const leadSummary = (row: any) => {
  const d = row.data ?? {};
  return { id: row.id, name: d.name || "(no name)", stage: STAGE_LABEL[d.stage] ?? d.stage, postcode: d.postcode || "", phone: d.phone || "" };
};

async function loadLead(id: string) {
  const { data, error } = await db.from("leads").select("id,data").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
async function saveLead(id: string, data: any) {
  const { error } = await db.from("leads").update({ data }).eq("id", id);
  if (error) throw new Error(error.message);
}
async function settings() {
  const { data } = await db.from("app_settings").select("business,rates").eq("id", 1).single();
  return data ?? { business: {}, rates: {} };
}

/* ---------------- tools ---------------- */

const TOOLS = [
  {
    name: "find_lead",
    description: "Search leads/enquiries by name, postcode or phone number. Returns matches with their id, name, stage, postcode and phone. Use the id with other tools.",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "Name, postcode or phone to search for" } }, required: ["query"] }
  },
  {
    name: "get_lead",
    description: "Full detail on one lead: contact info, stage, survey (area, grass, booked survey date), quote total, install (crew, start date), payment position and recent history.",
    inputSchema: { type: "object", properties: { lead_id: { type: "string" } }, required: ["lead_id"] }
  },
  {
    name: "create_lead",
    description: "Create a new enquiry. Returns the new lead id. Only name is required.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" }, phone: { type: "string" }, email: { type: "string" },
        postcode: { type: "string" }, address: { type: "string" }, note: { type: "string", description: "Anything about the job / what they want" }
      },
      required: ["name"]
    }
  },
  {
    name: "book_survey",
    description: "Book a survey appointment on a lead. Sets the date in the survey diary and moves the lead to 'Survey booked'. date is YYYY-MM-DD; time is optional 24h HH:MM.",
    inputSchema: {
      type: "object",
      properties: {
        lead_id: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM, 24-hour, optional" },
        note: { type: "string", description: "e.g. 'gate code 1234', 'access down side' — optional" }
      },
      required: ["lead_id", "date"]
    }
  },
  {
    name: "diary",
    description: "Upcoming survey appointments and booked installs over the next N days (default 14), soonest first.",
    inputSchema: { type: "object", properties: { days: { type: "number", description: "How many days ahead (default 14)" } } }
  },
  {
    name: "chase_list",
    description: "Leads whose follow-up is due today or overdue — who needs chasing right now.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "add_note",
    description: "Add a note to a lead's history (e.g. 'spoke to customer, wants to think about it').",
    inputSchema: { type: "object", properties: { lead_id: { type: "string" }, text: { type: "string" } }, required: ["lead_id", "text"] }
  },
  {
    name: "set_next_action",
    description: "Set when to next chase a lead, and optionally what to do. date is YYYY-MM-DD.",
    inputSchema: {
      type: "object",
      properties: { lead_id: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, note: { type: "string" } },
      required: ["lead_id", "date"]
    }
  },
  {
    name: "move_stage",
    description: "Move a lead to a different pipeline stage. stage must be one of: enquiry, survey, surveyed, quoted, won, installed, lost.",
    inputSchema: { type: "object", properties: { lead_id: { type: "string" }, stage: { type: "string" } }, required: ["lead_id", "stage"] }
  },
  {
    name: "list_todos",
    description: "The office to-do list (open items).",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "add_todo",
    description: "Add a task to the office to-do list.",
    inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] }
  },
  {
    name: "complete_todo",
    description: "Tick off a to-do. Give the exact text or a distinctive part of it.",
    inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] }
  },
  {
    name: "unpaid_invoices",
    description: "Invoices that haven't been marked paid, with amount and how many days since they were raised.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "mark_invoice_paid",
    description: "Mark an invoice as paid by its number.",
    inputSchema: { type: "object", properties: { number: { type: "number" } }, required: ["number"] }
  }
];

async function callTool(name: string, args: Record<string, any>): Promise<string> {
  const digits = (s: string) => String(s || "").replace(/\D/g, "");

  switch (name) {
    case "find_lead": {
      const q = String(args.query || "").trim();
      const { data, error } = await db.from("leads").select("id,data").limit(400);
      if (error) throw new Error(error.message);
      const ql = q.toLowerCase(), qd = digits(q), qpc = q.replace(/\s+/g, "").toLowerCase();
      const hits = (data ?? []).filter((r: any) => {
        const d = r.data ?? {};
        return (d.name || "").toLowerCase().includes(ql)
          || (qpc.length >= 3 && (d.postcode || "").replace(/\s+/g, "").toLowerCase().includes(qpc))
          || (qd.length >= 4 && digits(d.phone).includes(qd));
      }).slice(0, 15).map(leadSummary);
      return hits.length ? JSON.stringify(hits, null, 2) : `No leads match "${q}".`;
    }

    case "get_lead": {
      const row = await loadLead(args.lead_id);
      if (!row) return "No lead with that id.";
      const d = row.data ?? {};
      const out: any = {
        id: row.id, name: d.name, stage: STAGE_LABEL[d.stage] ?? d.stage,
        phone: d.phone, email: d.email, address: d.address, postcode: d.postcode,
        nextAction: d.nextAction || null, nextNote: d.nextNote || "",
        survey: {
          bookedFor: d.survey?.bookedFor || null, bookedNote: d.survey?.bookedNote || "",
          areaM2: d.survey?.areaM2 || null, grass: d.survey?.grassSpec || null
        },
        install: { crewId: d.job?.crewId || null, startDate: d.job?.startDate || null, days: d.job?.days || null, status: d.job?.status || null },
        payment: d.payment || {},
        history: (d.activity ?? []).slice(0, 8).map((a: any) => `${(a.ts || "").slice(0, 10)}: ${a.text}`)
      };
      return JSON.stringify(out, null, 2);
    }

    case "create_lead": {
      const today = todayISO();
      const lead = {
        name: args.name || "", phone: args.phone || "", email: args.email || "",
        address: args.address || "", postcode: args.postcode || "",
        source: "", campaign: "", channel: "manual",
        stage: "enquiry", createdAt: today, stageAt: today,
        nextAction: addDaysISO(today, 1), nextNote: "Call to qualify and book survey",
        lostReason: "",
        survey: { areaM2: "", grassSpec: "", accessPct: 0, notes: args.note || "" },
        quote: {}, job: {}, payment: {},
        activity: [{ ts: stamp(), text: "Added by Claude" }]
      };
      const { data, error } = await db.from("leads").insert({ data: lead }).select("id").single();
      if (error) throw new Error(error.message);
      return `Created. Lead id: ${data.id}`;
    }

    case "book_survey": {
      const row = await loadLead(args.lead_id);
      if (!row) return "No lead with that id.";
      const d = row.data ?? {};
      const when = args.time ? `${args.date}T${args.time}` : args.date;
      d.survey ??= {};
      d.survey.bookedFor = when;
      if (args.note) d.survey.bookedNote = args.note;
      if (d.stage === "enquiry") setStage(d, "survey");
      logActivity(d, `Survey booked for ${when}${args.note ? ` (${args.note})` : ""}`);
      await saveLead(row.id, d);
      return `Survey booked for ${d.name || "the lead"} on ${when}. It's in the diary.`;
    }

    case "diary": {
      const days = Math.max(1, Math.min(90, Number(args.days) || 14));
      const until = addDaysISO(todayISO(), days);
      const { data, error } = await db.from("leads").select("id,data").limit(600);
      if (error) throw new Error(error.message);
      const surveys: any[] = [], installs: any[] = [];
      for (const r of data ?? []) {
        const d = r.data ?? {};
        const bf = d.survey?.bookedFor;
        if (bf && ["enquiry", "survey"].includes(d.stage) && bf.slice(0, 10) <= until) {
          surveys.push({ when: bf, name: d.name, postcode: d.postcode, phone: d.phone, note: d.survey?.bookedNote || "", overdue: bf.slice(0, 10) < todayISO() });
        }
        const sd = d.job?.startDate;
        if (sd && d.job?.status !== "complete" && sd >= todayISO() && sd <= until) {
          installs.push({ start: sd, days: d.job?.days || 1, name: d.name, postcode: d.postcode });
        }
      }
      surveys.sort((a, b) => (a.when < b.when ? -1 : 1));
      installs.sort((a, b) => (a.start < b.start ? -1 : 1));
      return JSON.stringify({ nextDays: days, surveys, installs }, null, 2);
    }

    case "chase_list": {
      const t = todayISO();
      const { data, error } = await db.from("leads").select("id,data").limit(600);
      if (error) throw new Error(error.message);
      const rows = (data ?? []).filter((r: any) => {
        const d = r.data ?? {};
        return d.stage !== "lost" && d.nextAction && d.nextAction <= t;
      }).map((r: any) => {
        const d = r.data;
        return { id: r.id, name: d.name, stage: STAGE_LABEL[d.stage] ?? d.stage, due: d.nextAction, overdue: d.nextAction < t, todo: d.nextNote || "" };
      }).sort((a: any, b: any) => (a.due < b.due ? -1 : 1));
      return rows.length ? JSON.stringify(rows, null, 2) : "Nothing to chase — you're straight.";
    }

    case "add_note": {
      const row = await loadLead(args.lead_id);
      if (!row) return "No lead with that id.";
      const d = row.data ?? {};
      logActivity(d, String(args.text || ""));
      await saveLead(row.id, d);
      return "Noted.";
    }

    case "set_next_action": {
      const row = await loadLead(args.lead_id);
      if (!row) return "No lead with that id.";
      const d = row.data ?? {};
      d.nextAction = args.date;
      if (args.note != null) d.nextNote = args.note;
      logActivity(d, `Next action set to ${args.date}${args.note ? ` — ${args.note}` : ""}`);
      await saveLead(row.id, d);
      return `Will chase ${d.name || "them"} on ${args.date}.`;
    }

    case "move_stage": {
      const row = await loadLead(args.lead_id);
      if (!row) return "No lead with that id.";
      if (!STAGE_LABEL[args.stage]) return "Stage must be one of: enquiry, survey, surveyed, quoted, won, installed, lost.";
      const d = row.data ?? {};
      setStage(d, args.stage);
      await saveLead(row.id, d);
      return `${d.name || "Lead"} moved to ${STAGE_LABEL[args.stage]}.`;
    }

    case "list_todos": {
      const s = await settings();
      const open = (s.business?.todos ?? []).filter((x: any) => !x.done).map((x: any) => x.text);
      return open.length ? open.map((t: string) => `• ${t}`).join("\n") : "To-do list is empty.";
    }

    case "add_todo": {
      const s = await settings();
      const biz = s.business ?? {};
      biz.todos ??= [];
      biz.todos.unshift({ id: crypto.randomUUID(), text: String(args.text || "").trim(), done: false, createdAt: stamp() });
      const { error } = await db.from("app_settings").update({ business: biz }).eq("id", 1);
      if (error) throw new Error(error.message);
      return "Added to the to-do list.";
    }

    case "complete_todo": {
      const s = await settings();
      const biz = s.business ?? {};
      const q = String(args.text || "").toLowerCase().trim();
      const match = (biz.todos ?? []).find((x: any) => !x.done && x.text.toLowerCase().includes(q));
      if (!match) return `No open to-do matching "${args.text}".`;
      match.done = true; match.doneAt = todayISO();
      const { error } = await db.from("app_settings").update({ business: biz }).eq("id", 1);
      if (error) throw new Error(error.message);
      return `Ticked off: ${match.text}`;
    }

    case "unpaid_invoices": {
      const { data, error } = await db.from("invoices").select("id,data").limit(500);
      if (error) throw new Error(error.message);
      const s = await settings();
      const vatPct = s.business?.vat ? Number(s.rates?.vatPct ?? 20) : 0;
      const t = todayISO();
      const rows = (data ?? []).map((r: any) => r.data).filter((i: any) => i && !i.paid).map((i: any) => {
        const amt = Number(i.amount) || 0;
        const total = i.vat === false || !vatPct ? amt : (i.amountIncVat !== false ? amt : amt * (1 + vatPct / 100));
        const ageDays = i.date ? Math.round((Date.parse(t) - Date.parse(i.date)) / 86400000) : 0;
        return { number: i.number, customer: i.billTo?.name || "", total: Math.round(total * 100) / 100, daysSinceRaised: ageDays };
      }).sort((a: any, b: any) => b.daysSinceRaised - a.daysSinceRaised);
      return rows.length ? JSON.stringify(rows, null, 2) : "No unpaid invoices.";
    }

    case "mark_invoice_paid": {
      const { data, error } = await db.from("invoices").select("id,data").limit(500);
      if (error) throw new Error(error.message);
      const hit = (data ?? []).find((r: any) => Number(r.data?.number) === Number(args.number));
      if (!hit) return `No invoice numbered ${args.number}.`;
      hit.data.paid = true; hit.data.paidAt = todayISO();
      const { error: e2 } = await db.from("invoices").update({ data: hit.data }).eq("id", hit.id);
      if (e2) throw new Error(e2.message);
      return `Invoice ${args.number} marked paid.`;
    }
  }
  return `Unknown tool: ${name}`;
}

/* ---------------- MCP transport (Streamable HTTP, stateless) ---------------- */

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
const rpcError = (id: unknown, code: number, message: string) =>
  json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const seg = u.pathname.split("/").filter(Boolean).pop();
  const token = u.searchParams.get("key") || (seg && seg !== "mcp" ? seg : "");
  if (!KEY || token !== KEY) return json({ error: "forbidden" }, 403);

  if (req.method === "GET") return new Response("Method Not Allowed", { status: 405 });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let msg: any;
  try { msg = await req.json(); } catch { return rpcError(null, -32700, "Parse error"); }

  const { id, method, params } = msg ?? {};

  if (method === "initialize") {
    const asked = params?.protocolVersion;
    const version = ["2025-06-18", "2025-03-26", "2024-11-05"].includes(asked) ? asked : "2025-06-18";
    return json({
      jsonrpc: "2.0", id,
      result: {
        protocolVersion: version,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "turfline", title: "Turfline CRM", version: "1.0.0" },
        instructions: "Turfline is Yate Artificial Grass's CRM. Use these tools to look up leads, book surveys into the diary, check what needs chasing, and manage the to-do list. Call find_lead first to get a lead id, then use it with the other tools."
      }
    });
  }
  if (typeof method === "string" && method.startsWith("notifications/")) {
    return new Response(null, { status: 202 });
  }
  if (method === "ping") return json({ jsonrpc: "2.0", id, result: {} });
  if (method === "tools/list") return json({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
  if (method === "tools/call") {
    const tname = params?.name;
    if (!TOOLS.some((t) => t.name === tname)) return rpcError(id, -32602, `Unknown tool: ${tname}`);
    try {
      const text = await callTool(tname, params?.arguments ?? {});
      return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } });
    } catch (e) {
      return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true } });
    }
  }

  return rpcError(id, -32601, `Method not found: ${method}`);
});
