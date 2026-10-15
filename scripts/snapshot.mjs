// Saves a term's sections to data/snapshots/<term>.json for offline use.
// Usage: npm run snapshot -- 1272
import { fetchTerms, loadTerm } from "../lib/nyu.mjs";
import { writeSnapshot } from "../lib/cache.mjs";

const term = process.argv[2];
if (!/^\d{4}$/.test(term || "")) {
  console.error("Usage: npm run snapshot -- <4-digit NYU term id, e.g. 1272>");
  process.exit(1);
}

const terms = await fetchTerms();
const termName = terms.find((t) => t.id === term)?.name || term;
const data = await loadTerm(term, (done, total) => process.stdout.write(`\rDetails ${done}/${total}`));
data.termName = termName;
await writeSnapshot(term, data);
const missing = data.sections.filter((s) => !s.detailsOk).length;
console.log(`\nSaved ${data.sections.length} sections for ${termName} (${missing} without details).`);
