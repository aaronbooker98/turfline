// Small helpers with no DOM or app knowledge. Safe to import anywhere.

export function uid() {
  return globalThis.crypto?.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Escape a value for interpolation into an HTML string. Always use on user data. */
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Parse a number, falling back when blank or invalid. */
export const num = (v, fallback = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

/* ---- dates: stored everywhere as 'YYYY-MM-DD' strings, local time ---- */
export const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const todayISO = () => iso(new Date());
export const parseISO = (s) => {
  if (!s) return null;
  const [y, m, d] = String(s).split("-").map(Number);
  return Number.isFinite(y) ? new Date(y, m - 1, d) : null;
};
export const addDays = (s, n) => {
  const d = parseISO(s) ?? new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};
/** Whole days from a to b. Negative means b is in the past. */
export const dayDiff = (a, b) => {
  const x = parseISO(a), y = parseISO(b);
  if (!x || !y) return 0;
  return Math.round((y - x) / 86400000);
};
export const mondayOf = (s) => {
  const d = parseISO(s) ?? new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
};

/* ---- formatting ---- */
export const fmtDate = (s) =>
  parseISO(s)?.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) ?? "—";
export const fmtDateLong = (s) =>
  parseISO(s)?.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) ?? "—";
export const money = (n) =>
  "£" + (Number.isFinite(n) ? n : 0).toLocaleString("en-GB", { maximumFractionDigits: 0 });
export const money2 = (n) =>
  "£" + (Number.isFinite(n) ? n : 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Set a nested value from a dotted path, creating objects as needed. */
export function setPath(obj, path, value) {
  const parts = path.split(".");
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]] ??= {};
  o[parts.at(-1)] = value;
}
