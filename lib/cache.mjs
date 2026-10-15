// Live-fetch cache (data/cache, git-ignored) and committed snapshots (data/snapshots).
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CACHE_DIR = path.join(ROOT, "data", "cache");
const SNAPSHOT_DIR = path.join(ROOT, "data", "snapshots");
export const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function writeJson(dir, file, data) {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, file), JSON.stringify(data, null, 1) + "\n");
}

export async function readCache(term, maxAgeMs = CACHE_MAX_AGE_MS) {
  const data = await readJson(path.join(CACHE_DIR, `${term}.json`));
  if (!data || Date.now() - Date.parse(data.fetchedAt) > maxAgeMs) return null;
  return data;
}

export const writeCache = (term, data) => writeJson(CACHE_DIR, `${term}.json`, data);

export async function readSnapshot(term) {
  const data = await readJson(path.join(SNAPSHOT_DIR, `${term}.json`));
  return data && { ...data, source: "snapshot" };
}

export const writeSnapshot = (term, data) => writeJson(SNAPSHOT_DIR, `${term}.json`, data);

// Terms we can serve offline, for the term list when NYU is unreachable.
export async function snapshotTerms() {
  let files = [];
  try {
    files = await readdir(SNAPSHOT_DIR);
  } catch {
    return [];
  }
  const terms = [];
  for (const f of files.filter((f) => /^\d{4}\.json$/.test(f)).sort().reverse()) {
    const data = await readJson(path.join(SNAPSHOT_DIR, f));
    if (data) terms.push({ id: data.term, name: data.termName || data.term });
  }
  return terms;
}
