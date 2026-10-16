---
doc: spec
status: approved
---

# Takeable — Technical Spec

> The learner delegated the technical choices to the agent. The agent recommends what follows, and approving this document accepts it.

## How This Works, In Plain Language
Takeable is two small pieces running on your laptop.

1. **A tiny server (`server.mjs`).** When you pick a term, it asks NYU's public class search for that term's undergraduate online and blended sections. Then it asks for each section's details: the note, the credits, the instruction mode. The answers are tidied into one list and saved to a file, so the next visit is instant. If NYU can't be reached, it hands back a saved snapshot instead. The server is a go-between because a web page isn't allowed to call NYU's site directly.
2. **The web page (`public/`).** It gets that list once, then does all the judging itself.
   - Converts each class time from New York time to your city's time zone.
   - Checks the result against your class hours.
   - Looks up whether your home school gives credit.
   - Reads the note for restrictions.
   - Shows the verdict with its reasons.

Because the judging happens in the page, changing your city or hours re-sorts everything instantly, with no new request to NYU. Your choices and your starred shortlist sit in the browser's local storage, a small notebook the browser keeps for this one site.

Why this shape: no accounts, no database, no build step, and no paid services. The only outside dependency is NYU's own public search, and a snapshot covers it when it's down.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. **You open `http://localhost:5173`.**
   - The server sends `public/index.html`, `styles.css` and `app.js`.
   - `app.js` reads your saved situation from local storage. On a first visit it guesses your city from the browser's time zone.
2. **Term list.** `app.js` calls `GET /api/terms`. The server reads the term dropdown from NYU's class-search page (cached for a day) and returns e.g. `[{id:"1272", name:"January 2027"}, …]`.
3. **Sections.** `app.js` calls `GET /api/sections?term=1272`.
   - **If the cache is fresh** (`data/cache/1272.json`, under 6 hours old), the server returns it at once.
   - **Otherwise**, the server runs two searches on NYU (undergraduate + online, and undergraduate + blended) and one count of all undergraduate sections. It then fetches details for each section, four at a time.
   - While it works, it streams progress lines (`{"type":"progress","done":12,"total":55}`), which the summary strip shows as "Checking 12 of 55 sections…". It finishes with one `{"type":"result", …}` line carrying the normalised sections.
   - **If NYU fails**, it streams the snapshot from `data/snapshots/1272.json` with `source: "snapshot"`.
4. **Judging.** For every section, `app.js` runs `core/verdict.js`, which combines four checks:
   - `core/time.js` converts the meetings and checks them against your class hours
   - `core/notes.js` reads the asynchronous/synchronous signals and restriction phrases in the note
   - `core/schools.js` maps the code suffix to a school and applies the Stern credit rules
   - a 0-credit check

   `app.js` renders the summary strip and the grouped list.
5. **Search** filters the already-judged list in memory.
6. **Clicking a row** renders the detail panel from the same section object. The detail data arrived in step 3, so no new request is made.
7. **Star** writes the class number to local storage. The shortlist panel re-renders with totals; **Copy class numbers** uses the browser clipboard.
8. **Changing city or hours** saves the situation and re-runs step 4 for all sections, with no network call.

## Stack
- **Node.js 24 LTS** (installed for this hackathon) for the server, using only built-ins: `node:http`, `node:fs`, global `fetch`. Docs: https://nodejs.org/docs/latest-v24.x/api/
  - Why: nothing to install beyond what the hackathon already required, and judges can read the whole server in one file. Tradeoff: no Express conveniences; routing is about ten hand-written lines.
- **Plain HTML, CSS and JavaScript modules** in the browser. No framework, no bundler.
  - Why: one page with a handful of panels doesn't need React, and there's no build step to break. Tradeoff: rendering is hand-written DOM code.
- **`Intl.DateTimeFormat`** with IANA time zones for every time conversion. It's built into browsers and Node, and handles daylight saving. Docs: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
- **`node --test`** for unit tests of the pure logic in `public/core/`. Docs: https://nodejs.org/docs/latest-v24.x/api/test.html
- **Unverified, checked in build slice 1:**
  - NYU's `hours_html` text means credits
  - asynchronous sections are marked consistently

## Where It Runs and How Someone Tries It
- Runs locally. Needs Node.js 20 or newer. No API keys, no accounts.
- Start: `npm start`, then open `http://localhost:5173`.
- Tests: `npm test`.
- Refresh the bundled snapshot: `npm run snapshot -- 1272`.
- **Demo recording:** start the server, open the page in a clean browser window at about 1440×900, and walk through `scope.md > What "Working" Looks Like`:
  - Stern + Beijing + January 2027
  - TECH-UB 25 and ECON1-UC 301
  - switch to London
  - widen hours to 6:30 am to show THEA-UT 678 flip
  - star two sections and copy their class numbers
- **Submission:** needs a short demo video and a public GitHub repository. Deployment is optional and not planned. If chosen later, any Node host works, since the server has no dependencies.
- **Public repository:** https://github.com/yy5652-hash/takeable (public, MIT license detected by GitHub; checked without signing in on 2026-10-16).
- **Demo video:** final cut v1 approved by the learner on 2026-10-16. It is 2:00.6, 1080p, with captions in an .srt, and is not uploaded yet. It is built from real recordings of this app. The production files are outside the repository, in `takeable-film/`.

## Look and Feel
Carries forward `prd.md > Look and Feel` (revised in the final review).

**Palette:** CSS custom properties on `:root` in `public/styles.css`, with a dark set under `prefers-color-scheme: dark`.

| Token | Light |
| --- | --- |
| board | navy `#0e1726` → `#16223a` gradient |
| board ink | `#f3efe6` |
| board accent | amber `#f5b544` |
| page | `#f3f0e9` |
| surface | `#ffffff` |
| ink | `#141821` |
| Takeable | `#13703d` on `#dcf3e5`, solid `#22a05a` |
| Check | `#8f5d00` on `#fcefd2`, solid `#e3a21a` |
| Not takeable | `#b0232f` on `#fbe3e5`, solid `#e0484f` |

**Type:** Google Fonts with system fallbacks.
- Space Grotesk: headline, group titles, panel titles
- Inter: text
- JetBrains Mono: course codes, times, counts, clocks

**24-hour bar (`dialHtml` in `public/app.js`):**
- A 0–24 h track on the student's clock with night (0–6, 22–24) shaded.
- The class-hours window is a dashed band.
- Each distinct meeting range is a block, coloured with `fitsWindow`. A block that crosses midnight is drawn in two parts.
- Asynchronous sections get a striped full-width line.
- The detail panel repeats the bar for Mon–Sun (`weekHtml`).

**Layout:** board header, then a two-column page (cards on the left, shortlist or detail panel on the right, sticky). Below 900px the side becomes a bottom sheet.

**No NYU logo or violet.** The footer credits the data source.

## Components

### Server (`server.mjs`)
Serves `public/` as static files and routes `/api/terms` and `/api/sections`. It owns caching and the snapshot fallback, and streams NDJSON progress for long fetches.
PRD ref: `prd.md > Data Freshness`, `prd.md > Situation Bar` (term list).

### NYU Client (`lib/nyu.mjs`)
- `fetchTerms()` parses the `crit-srcdb` options from the class-search page.
- `searchSections(term, criteria)` and `fetchDetails(term, code, crn)` call the FOSE API.
- `normalizeSection(searchRow, details)` produces the Section shape in Data Model.
- Requests run with concurrency 4, a 20-second timeout, and one retry. Cancelled sections (`isCancelled`) are dropped.

PRD ref: `prd.md > Data Freshness`.

### Cache and Snapshots (`lib/cache.mjs`, `scripts/snapshot.mjs`)
- Reads and writes `data/cache/<term>.json` with `fetchedAt`; fresh for 6 hours.
- The snapshot script writes `data/snapshots/<term>.json` in the same shape.

PRD ref: `prd.md > Data Freshness`.

### Time Conversion (`public/core/time.js`)
- `toLocal(meeting, sessionDate, tz)` treats `HHMM` on the real session date as America/New_York wall time, finds the exact instant, and formats it in `tz`. It returns local day, start and end, and whether the class crosses local midnight.
- `fitsWindow(local, window)` checks a meeting against the class hours.
- The check runs for the first and last week of the session; if daylight saving moves the time, both are reported.

PRD ref: `prd.md > Takeability Verdict` (Time on your clock).

### Note Reader (`public/core/notes.js`)
- `readNote(text)` returns:
  - `async`: true, false or unknown, from phrases like "asynchronous", "Meets asynchronously", "Synchronous attendance is required", "via Zoom"
  - `restrictions`: the matching sentences quoted verbatim, from the phrase list in the PRD
- HTML entities are decoded.

PRD ref: `prd.md > Takeability Verdict` (Restrictions in the section note).

### School Rules (`public/core/schools.js`)
`schoolOf(code, collegeLabel)` maps the code suffix to a school:

| Suffix | School |
| --- | --- |
| UB | Stern |
| UA | Arts & Science |
| UE | Steinhardt |
| UT | Tisch |
| UG | Gallatin |
| US | Silver |
| UY | Tandon |
| UC | SPS |
| UF | Liberal Studies |
| UH | NYU Abu Dhabi |
| SHU | NYU Shanghai |
| UN | Nursing |
| UD | Dentistry |
| UZ | Non-School Based Programs |

Wagner's undergraduate courses use the `UPADM-GP` subject prefix. If a suffix is unknown, the school comes from NYU's `college` label.

`creditRule(homeSchool, school)` encodes the Stern undergrad rule set:
- Stern itself, and the approved list (Arts & Science, Steinhardt, Tisch, Gallatin, Wagner, Silver, Tandon with an adviser note): pass.
- SPS: hard fail.
- Everything else: Check.

Source URL: https://www.stern.nyu.edu/current-students/undergraduate/academics/minors-and-electives. The URL and the date it was checked live in the file.

PRD ref: `prd.md > Takeability Verdict` (Credit at home school).

### Verdict (`public/core/verdict.js`)
`judge(section, situation)` returns `{verdict, reasons[]}`. Each reason is `{kind: "time"|"credit"|"restriction"|"credits", level: "pass"|"check"|"fail", text, evidence}`.
- Any `fail` gives Not takeable; else any `check` gives Check; else Takeable.
- Reasons are ordered fail → check → pass, so the row shows the most important one.

PRD ref: `prd.md > Takeability Verdict`.

### City List (`public/core/cities.js`)
The PRD's city list mapped to IANA zones, plus `Intl.supportedValuesOf("timeZone")` for "Other time zone…". It also guesses the city from the browser's own time zone.
PRD ref: `prd.md > Situation Bar`.

### Page (`public/index.html`, `public/app.js`, `public/styles.css`)
Owns state:
- `situation`
- `sections`
- `search`
- `starred`
- `openSection`

It renders the Situation Bar, Summary Strip, Section List, Detail Panel, Shortlist and Footer banner, wires the events, and persists `situation` and `starred` to local storage. Esc closes the detail panel.

PRD ref: `prd.md > Situation Bar`, `prd.md > Section List and Search`, `prd.md > Section Details`, `prd.md > Shortlist`, `prd.md > States and Boundaries`.

## Data Model

**Section** (server → page; also the cache and snapshot format):
```js
{
  term: "1272", crn: "1258", code: "TECH-UB 25", section: "040",
  title: "Introduction to Programming for Data Science using Python",
  subject: "TECH", suffix: "UB", college: "Stern School of Business - Undergrad",
  credits: { min: 1.5, max: 1.5 }, component: "Lecture",
  mode: "online" | "blended",
  meetings: [{ day: 0, start: "0900", end: "1300" }],   // day 0 = Monday, New York time
  meetsText: "MWF 9a-1p; TR 9a-1p",
  startDate: "2027-01-04", endDate: "2027-01-14",
  note: "Open to first-years and above. Synchronous attendance is required. …",
  description: "…", campus: "Washington Square"
}
```

**Sections payload:**
```js
{ term, termName, source: "live" | "snapshot", fetchedAt, inPersonHidden: 230, sections: [Section] }
```

**Situation** (local storage `takeable.situation`):
```js
{ homeSchool: "stern" | "other", tz: "Asia/Shanghai", cityLabel: "Beijing", guessed: true, term: "1272", window: { earliest: "08:00", latest: "23:00" } }
```

**Shortlist** (local storage `takeable.starred`):
```js
{ "1272": ["1258", "1441"] }   // class numbers per term
```

Nothing else is stored. Verdicts are always recomputed from Section + Situation.

## File Structure
```
build-with-ai-basics/            # repository root
├── server.mjs                   # static server + /api/terms, /api/sections (NDJSON stream)
├── lib/
│   ├── nyu.mjs                  # NYU class search client + normalizeSection
│   └── cache.mjs                # data/cache read/write with freshness
├── public/
│   ├── index.html               # page skeleton
│   ├── styles.css               # tokens, light/dark, layout, chips
│   ├── app.js                   # state, rendering, events, local storage
│   └── core/                    # pure logic, shared by the page and the tests
│       ├── time.js
│       ├── notes.js
│       ├── schools.js
│       ├── verdict.js
│       └── cities.js
├── data/
│   ├── snapshots/1272.json      # January 2027 snapshot (committed, offline demo)
│   └── cache/                   # live cache (git-ignored)
├── scripts/snapshot.mjs         # npm run snapshot -- <term>
├── tests/
│   ├── time.test.mjs
│   ├── notes.test.mjs
│   ├── schools.test.mjs
│   └── verdict.test.mjs         # PRD acceptance cases on snapshot fixtures
├── package.json                 # scripts: start, test, snapshot; no dependencies
├── README.md                    # what it is, how to run, data source and limits
├── LICENSE                      # MIT
├── .gitignore
└── devpost/                     # planning docs (learner-profile.md stays git-ignored)
```

## External Services and Dependencies

### NYU class search (FOSE API)
Public, no key, undocumented; used gently with caching.

**Terms.** `GET https://bulletins.nyu.edu/class-search/`. Parse `<select id="crit-srcdb">` options (`value` = term id, text = name).

**Search.** `POST https://bulletins.nyu.edu/class-search/api/?page=fose&route=search` with `Content-Type: application/json`:
```json
{"other":{"srcdb":"1272"},"criteria":[{"field":"instmode","value":"OL"},{"field":"career","value":"UGRD"}]}
```
- `instmode`: `OL` online, `OB` blended, `P` in person.
- Response: `{srcdb, count, results:[{code, title, crn, no, schd, stat, isCancelled, meets, meetingTimes /* JSON string */, start_date, end_date}]}`.
- Observed 2026-10-15: January 2027 has 55 online undergrad sections; Fall 2026 has 343.

**Details.** `POST https://bulletins.nyu.edu/class-search/api/?page=fose&route=details`:
```json
{"group":"code:TECH-UB 25","key":"crn:1258","srcdb":"1272","matched":"crn:1258"}
```
- Response includes `college`, `hours_html` (e.g. "1.5 Hour Lecture"), `instructional_method`, `campus_location`, `description`, `meeting_html`, `dates_html`, `clssnotes` (HTML).

**Limits.** No published rate limit. We use four concurrent requests, a `User-Agent` naming the project, and a 6-hour cache. Cost: free.

### Stern policy page (cited, not fetched at runtime)
https://www.stern.nyu.edu/current-students/undergraduate/academics/minors-and-electives (checked 2026-10-15).

## Important Failure Modes
- **NYU search unreachable or its response shape changes** → the server falls back to the snapshot. The page shows "Couldn't reach NYU — showing saved data from <date>". With no snapshot for that term: "This term isn't available offline."
- **Some detail calls fail** → those sections keep their search data, and the verdict adds "Check: details unavailable from NYU". The fetch doesn't fail as a whole.
- **Time zone and daylight-saving edge cases** → conversion uses real session dates through `Intl`. If the local time shifts during the term, the reason says so ("10:00 pm – 2:00 am; 11:00 pm – 3:00 am after Nov 1").

## What Was Simplified and Why
- **Online and blended sections only** instead of all sections. The audience is away from campus. Adding all of them would mean mapping global-site location codes.
- **Stern rule set only** instead of every school's rules. One sourced rule set proves the credit check; each extra school is a data entry, not new code.
- **Restrictions as quoted Check** instead of parsed eligibility. Parsing year and major needs a student profile and risks wrong hard verdicts.
- **A file cache plus a committed snapshot** instead of a database. It's one term's list at a time, and the shape is the same either way.
- **Local run plus video** instead of deployment. Deployment is optional, and the demo doesn't depend on it.

## Decisions and Open Issues
**Decisions.** The learner delegated technical choices. These are agent recommendations, accepted on approval:
- **No-dependency Node server + plain JS page:** smallest surface that runs anywhere Node runs. Tradeoff: hand-written DOM.
- **Judging in the browser:** instant re-sorting when the city or hours change. Tradeoff: the full section list is sent to the page (a few hundred KB for the largest term).
- **Streamed progress for first fetches:** the first load of a large term takes a minute or two, and silence would look broken.

**Learner unknown.** The learner's stated learning goal is working well with an AI agent, not a technical topic. No technical uncertainty was raised, because they delegated the choices. The genuine unknown is in the data, and it gets a small investigation in build slice 1. A script prints, across a full term:
- how `hours_html` reads for known courses
- how many sections have no meetings and no asynchronous signal

Results go in the checklist.

**Open (from `prd.md > Open Questions`).**
- Do the `hours_html` numbers equal credits? Check in slice 1.
- Are asynchronous markers consistent? Check in slice 1.
