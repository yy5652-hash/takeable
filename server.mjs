// Takeable's local server: static files from public/ plus two JSON routes.
//   GET /api/terms                  -> [{id, name}]
//   GET /api/sections?term=1272     -> NDJSON stream: progress lines, then one result line
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { fetchTerms, loadTerm } from "./lib/nyu.mjs";
import { readCache, readSnapshot, snapshotTerms, writeCache } from "./lib/cache.mjs";

const PORT = Number(process.env.PORT) || 5173;
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

let termsCache = null; // { at, terms }
const inFlight = new Map(); // term -> { promise, listeners:Set }

async function handleTerms(res) {
  if (termsCache && Date.now() - termsCache.at < 24 * 60 * 60 * 1000) return sendJson(res, termsCache.terms);
  try {
    const terms = await fetchTerms();
    termsCache = { at: Date.now(), terms };
    sendJson(res, terms);
  } catch (err) {
    console.warn(`Term list unavailable from NYU (${err.message}); using snapshots`);
    sendJson(res, await snapshotTerms());
  }
}

function loadShared(term, termName, onProgress) {
  let job = inFlight.get(term);
  if (!job) {
    const listeners = new Set();
    const promise = loadTerm(term, (done, total) => listeners.forEach((fn) => fn(done, total)))
      .then(async (data) => {
        data.termName = termName;
        await writeCache(term, data);
        return data;
      })
      .finally(() => inFlight.delete(term));
    job = { promise, listeners };
    inFlight.set(term, job);
  }
  job.listeners.add(onProgress);
  return job.promise.finally(() => job.listeners.delete(onProgress));
}

async function handleSections(req, res, url) {
  const term = url.searchParams.get("term") || "";
  if (!/^\d{4}$/.test(term)) return sendJson(res, { error: "term must be a 4-digit NYU term id" }, 400);
  const termName = (url.searchParams.get("name") || term).slice(0, 40);

  res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" });
  const line = (obj) => res.write(JSON.stringify(obj) + "\n");

  const cached = await readCache(term);
  if (cached) {
    line({ type: "result", ...cached, source: "live" });
    return res.end();
  }
  try {
    const data = await loadShared(term, termName, (done, total) => line({ type: "progress", done, total }));
    line({ type: "result", ...data });
  } catch (err) {
    console.warn(`Live load failed for ${term} (${err.message}); trying snapshot`);
    const snap = await readSnapshot(term);
    if (snap) line({ type: "result", ...snap, liveError: err.message });
    else line({ type: "error", message: "Couldn't reach NYU, and this term isn't available offline." });
  }
  res.end();
}

async function handleStatic(res, pathname) {
  const rel = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return sendText(res, "Not found", 404);
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    sendText(res, "Not found", 404);
  }
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": TYPES[".json"] });
  res.end(JSON.stringify(data));
}

function sendText(res, text, status) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method !== "GET") return sendText(res, "Method not allowed", 405);
    if (url.pathname === "/api/terms") return await handleTerms(res);
    if (url.pathname === "/api/sections") return await handleSections(req, res, url);
    return await handleStatic(res, url.pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendText(res, "Server error", 500);
    else res.end();
  }
});

server.listen(PORT, () => console.log(`Takeable running at http://localhost:${PORT}`));
