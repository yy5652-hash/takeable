# Takeable

Which NYU courses can you actually take from where you'll be?

Takeable reads NYU's public class search and gives every online or blended undergraduate section one of three verdicts:

- **✓ Takeable**
- **? Check**
- **✕ Not takeable**

Each verdict comes with its reasons. A section is judged on three things:

1. **Your clock.** Meeting times are converted from New York time to your city on the real session dates, so daylight saving is handled. A section fails if it meets outside the class hours you set. Asynchronous sections pass.
2. **Your home school's credit rules.** The Stern undergraduate rules are encoded from Stern's published [Minors and Electives policy](https://www.stern.nyu.edu/current-students/undergraduate/academics/minors-and-electives):
   - Approved outside schools pass.
   - School of Professional Studies courses get no credit.
   - Anything else is a Check.
3. **NYU's own section notes.** Restrictions such as "Open to Stern seniors only" or "Departmental approval required" are quoted as a Check. Takeable never guesses your class year or major.

Example, January 2027, Stern student:
- **TECH-UB 25** is listed as *Online*. It requires synchronous attendance 9:00 am – 1:00 pm New York time, which is 10:00 pm – 2:00 am in Beijing, so it's **Not takeable** from Beijing. From London (2:00 – 6:00 pm) it's fine.
- **ECON1-UC 301** is asynchronous, but it's a School of Professional Studies course, so there's no Stern credit.

## Run it

Requires Node.js 20 or newer. No dependencies, accounts or API keys.

```bash
npm start          # http://localhost:5173
npm test           # unit tests for time conversion, notes, credit rules and verdicts
npm run snapshot -- 1272   # refresh the saved January 2027 data
```

Set `PORT` to change the port.

**How the data loads:**
- The first load of a term fetches section details from NYU and caches them in `data/cache/` for six hours.
- A large term (Fall 2026, ~500 sections) takes a minute or two the first time, with progress shown.
- If NYU can't be reached, Takeable uses `data/snapshots/<term>.json` and says so on screen. The snapshot for January 2027 is included.

## Using it

1. Fill in the sentence at the top:
   - your home school
   - where you'll be (a city, or any time zone)
   - the term
   - the hours you're willing to be in class
2. Sections are grouped Takeable → Check → Not takeable.
3. Click a section to see the evidence:
   - meeting times in your time and New York time
   - dates and credits
   - NYU's note, quoted
   - the credit rule and its source
4. Star sections (☆) to build a shortlist with total credits. **Copy class numbers** copies them for registration.

Your choices and shortlist stay in this browser's local storage. Nothing else is stored.

## How it's built

| Path | What it does |
| --- | --- |
| `server.mjs` | Static files plus `/api/terms` and `/api/sections` (streams progress as NDJSON) |
| `lib/nyu.mjs` | NYU class search client (CourseLeaf FOSE `search` and `details`), normalisation |
| `lib/cache.mjs` | Six-hour file cache and committed snapshots |
| `public/core/time.js` | New York wall time → any time zone on real dates; class-hours check |
| `public/core/notes.js` | Synchronous/asynchronous signals and restriction sentences in NYU notes |
| `public/core/schools.js` | Course-code suffix → school; Stern credit rules with source |
| `public/core/verdict.js` | Combines reasons into the verdict |
| `public/app.js` | The page: situation sentence, list, detail panel, shortlist |
| `tests/` | `node --test` suites, including every acceptance case in the PRD |

**Planning.** Takeable was planned before it was built, with the Devpost Learn skill pack. The planning documents are in [`devpost/`](devpost):
- [`scope.md`](devpost/scope.md)
- [`prd.md`](devpost/prd.md)
- [`spec.md`](devpost/spec.md)
- [`checklist.md`](devpost/checklist.md), which records the build slices and what the build discovered

## Limits

- **Covers:** NYU only, Stern's credit rules only, and online or blended undergraduate sections. In-person sections are counted, not listed.
- **Data source:** NYU's class search API is public but undocumented. Takeable uses it gently (four requests at a time, cached), but it may change without notice.
- **Not advice:** Takeable is a student project, not an NYU service. Confirm with your adviser before you register.

## License

[MIT](LICENSE)
