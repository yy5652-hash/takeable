// Client for NYU's public class search (CourseLeaf FOSE). No login or key needed.
// Search: POST <base>api/?page=fose&route=search; details: route=details.

const BASE = process.env.NYU_CLASS_SEARCH_URL || "https://bulletins.nyu.edu/class-search/";
const API = new URL("api/?page=fose&route=", BASE).toString();
const HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "Takeable (student course-planning project)",
};
const TIMEOUT_MS = 20_000;
const CONCURRENCY = 6;

async function withRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    await new Promise((r) => setTimeout(r, 500));
    return fn();
  }
}

async function post(route, body) {
  return withRetry(async () => {
    const res = await fetch(API + route, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`NYU ${route} returned ${res.status}`);
    const json = await res.json();
    if (json.fatal) throw new Error(`NYU ${route}: ${json.fatal}`);
    return json;
  });
}

export async function fetchTerms() {
  const html = await withRetry(async () => {
    const res = await fetch(BASE, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`NYU class search page returned ${res.status}`);
    return res.text();
  });
  const select = html.match(/<select id="crit-srcdb"[\s\S]*?<\/select>/);
  if (!select) throw new Error("Term list not found on NYU class search page");
  const terms = [...select[0].matchAll(/<option value="(\d{4})"[^>]*>([^<]+)/g)].map((m) => ({
    id: m[1],
    name: decodeEntities(m[2]).trim(),
  }));
  if (!terms.length) throw new Error("NYU class search listed no terms");
  return terms;
}

export async function searchSections(term, criteria) {
  const json = await post("search", { other: { srcdb: term }, criteria });
  return json;
}

export async function fetchDetails(term, code, crn) {
  return post("details", { group: `code:${code}`, key: `crn:${crn}`, srcdb: term, matched: `crn:${crn}` });
}

const UGRD = { field: "career", value: "UGRD" };

// Loads a term's undergraduate online and blended sections with their details.
// onProgress(done, total, section) is called as each section's details arrive, so pages can show results early.
// Details start as soon as the online search answers; the blended search joins the queue when it lands, and the
// in-person count (shown only as a number) never holds anything up.
export async function loadTerm(term, onProgress = () => {}) {
  const inPerson = searchSections(term, [{ field: "instmode", value: "P" }, UGRD]).catch(() => ({ count: 0 }));
  const searches = [
    ["online", searchSections(term, [{ field: "instmode", value: "OL" }, UGRD])],
    ["blended", searchSections(term, [{ field: "instmode", value: "OB" }, UGRD])],
  ];

  const queue = [];
  const sections = [];
  const seen = new Set();
  let done = 0;
  let searching = searches.length;
  const waiting = [];
  const wake = () => waiting.splice(0).forEach((r) => r());
  const add = (mode, result) => {
    for (const row of result.results || []) {
      if (row.isCancelled || seen.has(row.crn)) continue;
      seen.add(row.crn);
      queue.push({ mode, row });
    }
    onProgress(done, seen.size, null);
    wake();
  };
  const settled = searches.map(([mode, p]) => p.then((r) => add(mode, r)).finally(() => { searching--; wake(); }));

  async function worker() {
    for (;;) {
      if (!queue.length) {
        if (!searching) return;
        await new Promise((r) => waiting.push(r));
        continue;
      }
      const { mode, row } = queue.shift();
      let details = null;
      try {
        details = await fetchDetails(term, row.code, row.crn);
      } catch {
        details = null;
      }
      const section = normalizeSection(row, details, mode);
      sections.push(section);
      onProgress(++done, seen.size, section);
    }
  }
  await Promise.all([...Array.from({ length: CONCURRENCY }, worker), ...settled]);

  const order = new Map([...seen].map((crn, i) => [crn, i]));
  sections.sort((a, b) => order.get(a.crn) - order.get(b.crn));
  return {
    term,
    source: "live",
    fetchedAt: new Date().toISOString(),
    inPersonHidden: Number((await inPerson).count) || 0,
    sections,
  };
}

export function normalizeSection(row, details, mode) {
  const [subject, suffix] = splitCode(row.code);
  let meetings = [];
  try {
    meetings = JSON.parse(row.meetingTimes || "[]").map((m) => ({
      day: Number(m.meet_day),
      start: String(m.start_time).padStart(4, "0"),
      end: String(m.end_time).padStart(4, "0"),
    }));
  } catch {
    meetings = [];
  }
  const d = details || {};
  return {
    term: row.srcdb,
    crn: row.crn,
    code: row.code,
    section: row.no,
    title: decodeEntities(row.title || ""),
    subject,
    suffix,
    college: textOf(d.college),
    credits: parseCredits(textOf(d.hours_html)),
    component: textOf(d.component) || componentOf(row.schd),
    mode,
    meetings,
    meetsText: row.meets || "",
    startDate: row.start_date,
    endDate: row.end_date,
    note: textOf(d.clssnotes),
    description: textOf(d.description),
    campus: textOf(d.campus_location),
    detailsOk: Boolean(details),
  };
}

// "TECH-UB 25" -> ["TECH", "UB"]; "BUSF-SHU 101" -> ["BUSF", "SHU"]
export function splitCode(code) {
  const m = /^([A-Z0-9]+)-([A-Z]+)\s/.exec(code || "");
  return m ? [m[1], m[2]] : ["", ""];
}

// "4 Hour Lecture" -> {min:4,max:4}; "1-4 Hour Seminar" -> {min:1,max:4}
export function parseCredits(text) {
  const m = /^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s+Hours?\b/i.exec(text || "");
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[2] ? Number(m[2]) : min;
  return { min, max };
}

function componentOf(schd) {
  return { LEC: "Lecture", SEM: "Seminar", LAB: "Laboratory", STU: "Studio", IND: "Independent Study" }[schd] || schd || "";
}

export function textOf(html) {
  if (!html) return "";
  return decodeEntities(String(html).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function decodeEntities(s) {
  return String(s)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
