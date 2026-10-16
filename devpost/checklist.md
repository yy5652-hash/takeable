---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. Live NYU sections, judged on your clock**
  Becomes usable: `npm start`, open the page, pick a city and a term. Real NYU online and blended sections appear with their meeting time converted to your clock and a time verdict. For example, TECH-UB 25 shows ✕ "Meets 10:00 pm – 2:00 am your time" from Beijing and passes from London. Asynchronous sections pass.
  Why now: The NYU API is the biggest risk and the time verdict is the heart of the kernel. Proving both first means everything later lands on real data. It also runs the agreed data investigation (do credits equal "hours", are asynchronous markers consistent) before any rule depends on it.
  PRD ref: `prd.md > The Core Journey` (steps 1–4, 8), `prd.md > Takeability Verdict` (Time on your clock), `prd.md > Situation Bar`
  Spec ref: `spec.md > Server (server.mjs)`, `spec.md > NYU Client (lib/nyu.mjs)`, `spec.md > Cache and Snapshots (lib/cache.mjs, scripts/snapshot.mjs)`, `spec.md > Time Conversion (public/core/time.js)`, `spec.md > Note Reader (public/core/notes.js)`, `spec.md > City List (public/core/cities.js)`, `spec.md > Data Model`, `spec.md > File Structure`
  Build: Do the following.
    - Scaffold `package.json` (start, test and snapshot scripts; no dependencies).
    - Write `server.mjs` with static files, `/api/terms`, and `/api/sections` streaming NDJSON.
    - Write `lib/nyu.mjs` (search, details, normalizeSection, concurrency 4) and `lib/cache.mjs`.
    - Write `scripts/snapshot.mjs` and commit `data/snapshots/1272.json`.
    - Write `core/time.js`, `core/notes.js` (async and sync signals), `core/cities.js`, and a first `core/verdict.js` with the time reason only.
    - Build a basic page: city, term and class-hours controls, and a grouped list with local time and the verdict chip.
    - Run the data investigation and record the result under Revisions.
  Verify (mechanical): Run these checks.
    - `npm test` passes the time tests: TECH-UB 25 Mon 9:00–13:00 NY on 2027-01-04 → Beijing 22:00–02:00 (crosses midnight, fails an 8:00–23:00 window) and → London 14:00–18:00 (passes); a Fall 2026 date after Nov 1 shifts correctly.
    - `curl localhost:5173/api/terms` lists January 2027.
    - `curl localhost:5173/api/sections?term=1272` streams progress and ends with 55+ sections.
    - With the NYU host unreachable (bad base URL via env var), the same call returns `source: "snapshot"`.
    - In the browser preview, TECH-UB 25 shows ✕ for Beijing and not ✕ for London.
  Learner check: Run `npm start`, open http://localhost:5173, choose Beijing and January 2027, and find TECH-UB 25. Its time should read about 10 pm – 2 am with a red ✕. Switch to London and watch it change.
  Commit: `Load live NYU sections and judge them on the student's clock`

- [x] **2. Credit and restrictions complete the verdict**
  Becomes usable: Choosing Stern judges credit too.
    - ECON1-UC 301 shows ✕ "No Stern credit for SPS courses".
    - Tisch and Arts & Science courses say they count as approved outside electives.
    - Liberal Studies courses show ? "Not on Stern's approved list".
    - Notes like "Open to Stern seniors only" put a section in ? Check, with the note quoted.
    - The list groups Takeable → Check → Not takeable, and the summary strip shows the counts.
  Why now: This completes the kernel (all three reasons). Its rules are the place where wrong data would mislead students, so the PRD acceptance cases get tested here.
  PRD ref: `prd.md > Takeability Verdict`, `prd.md > Situation Bar` (home school), `prd.md > Section List and Search` (grouping)
  Spec ref: `spec.md > School Rules (public/core/schools.js)`, `spec.md > Verdict (public/core/verdict.js)`, `spec.md > Note Reader (public/core/notes.js)`
  Build: Write `core/schools.js` (suffix map, Wagner prefix, Stern rule set with source URL and checked date) and the restriction phrases in `core/notes.js`. Make `core/verdict.js` combine time, credit, restriction and 0-credit reasons with fail → check → pass ordering. Add the home-school control, grouped rendering and the summary strip counts.
  Verify (mechanical): Run these checks.
    - `npm test` passes the verdict tests on snapshot fixtures. Each PRD acceptance case in `prd.md > Takeability Verdict` has a test:
      - TECH-UB 25 Beijing ✕ (time)
      - ECON1-UC 301 ✕ (SPS)
      - TECH-UB 25 London not ✕
      - THEA-UT 678 flips at a 6:30 am earliest start
      - every verdict has at least one reason
    - In the browser preview the counts add up to the number of sections loaded.
  Learner check: Choose Stern + Beijing + January 2027 and look at the three groups. Do the ✓ / ? / ✕ verdicts and their one-line reasons make sense to you as a Stern student? Then switch to London.
  Commit: `Add Stern credit rules and restriction checks to the verdict`

- [x] **3. See the evidence and search**
  Becomes usable: Clicking any row opens a detail panel with:
    - New York vs local times
    - Session dates and instruction mode
    - The quoted note
    - The credit rule with its link
    - The description

  The search box narrows the list by code, title or subject, with counts following. The summary strip shows how many in-person sections are hidden.
  Why now: The verdict is only trustworthy if its evidence is one click away. Search makes a full term (hundreds of sections) usable.
  PRD ref: `prd.md > Section Details`, `prd.md > Section List and Search`, `prd.md > The Core Journey` (steps 5–6)
  Spec ref: `spec.md > Page (public/index.html, public/app.js, public/styles.css)`, `spec.md > Data Model`
  Build: Add a detail panel that slides over the right column (Esc and close button), a search input with in-memory filtering, and the in-person hidden count in the strip.
  Verify (mechanical): In the browser preview:
    - Open TECH-UB 25 and confirm the panel times match its row and the note text is verbatim.
    - Type "TECH" and confirm only TECH rows remain and the counts change.
    - Press Esc and confirm the panel closes.
  Learner check: Click a red ✕ course and a green ✓ course. Does the panel show you enough to trust the verdict? Search for a subject you'd actually take.
  Commit: `Add section detail panel, search and in-person count`

- [x] **4. Shortlist and a remembered situation**
  Becomes usable: Star sections from a row or the panel. The shortlist shows them with current verdicts, total credits (ranges for variable credit) and **Copy class numbers**. Your city, term, hours, home school and stars survive a reload. On first visit the city is guessed from the computer's time zone, with a "guessed" label.
  Why now: This closes the core loop (decide → keep → act in registration) once the verdicts it shows are complete.
  PRD ref: `prd.md > Shortlist`, `prd.md > Situation Bar`, `prd.md > States and Boundaries` (persistence, first use)
  Spec ref: `spec.md > Page (public/index.html, public/app.js, public/styles.css)`, `spec.md > City List (public/core/cities.js)`, `spec.md > Data Model` (Situation, Shortlist)
  Build: Add star toggles, the shortlist panel with totals and clipboard copy, local storage for `takeable.situation` and `takeable.starred`, and first-visit guessing from `Intl.DateTimeFormat().resolvedOptions().timeZone`.
  Verify (mechanical): In the browser preview:
    - Star TECH-UB 25 and ECON1-UC 301 → the shortlist shows both and totals 5.5 credits.
    - Copy → the clipboard reads "1258, 1441".
    - Reload → stars and situation persist.
    - Clear local storage → the city is guessed and labelled.
  Learner check: Star two courses you might really take, reload the page, and paste the copied class numbers somewhere. Are they what you'd type into Albert?
  Commit: `Add shortlist with credit totals, copy, and remembered situation`

- [x] **5. Trustworthy edges and the finished look**
  Becomes usable: Takeable now handles the edge cases and looks finished.
    - A first fetch shows "Checking N of M sections…".
    - When NYU is unreachable it uses the snapshot and shows a banner. A term with no snapshot shows a clear message.
    - "Nothing takeable" shows an empty state naming the main blocker and offering to widen class hours. "No search matches" has its own state.
    - A daylight-saving shift is noted in the reason.
    - The full `spec.md > Look and Feel` applies (palette, type, chips, dark mode), with a bottom-sheet shortlist on narrow screens and a footer data credit with fetch time.
    - The repository gets a README and an MIT LICENSE.
  Why now: These are the states a judge or a real student will hit in the first minute. Polish comes last so it styles real behavior rather than placeholders.
  PRD ref: `prd.md > Data Freshness`, `prd.md > States and Boundaries`, `prd.md > Look and Feel`, `prd.md > Screens and Layout`
  Spec ref: `spec.md > Important Failure Modes`, `spec.md > Look and Feel`, `spec.md > Where It Runs and How Someone Tries It`
  Build: Do the following.
    - Render progress from the NDJSON stream, plus the snapshot banner and offline message.
    - Add the empty states, using the most frequent fail reason.
    - Add the DST note in time reasons, the final CSS tokens with light and dark themes, the responsive layout and the footer.
    - Write README.md (what, why, run, data source, limits) and LICENSE (MIT).
  Verify (mechanical): `npm test` passes. In the browser preview, check each of these:
    - Delete the cache and confirm the progress text appears during the fetch.
    - Point the NYU base URL at an unreachable host and confirm the banner.
    - Narrow the class hours to 2:00–3:00 pm in Beijing and confirm the empty state.
    - Test a 375px width and dark mode.
    - Check the console for errors.
  Learner check: Open the app fresh in a narrow window and in dark mode, and turn Wi-Fi off and reload. Does everything still make sense, and does it look like something you'd show judges?
  Commit: `Add loading, offline and empty states, final styling, README and license`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 2 (full verdict on real data), before detail, search and shortlist are built on top of it
  Learner tried Beijing → 6:30 am → London on January 2027: "判定和理由都说得通，没有要改的" (verdicts and reasons make sense, nothing to change).
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: not started
Route and stops: not started
Edit outcome: not started
Reflection: not started
Activity mode: not started

## Revisions

- Credits: no change needed. The slice-1 investigation found NYU's `hours_html` number equals credits for five sampled courses (TECH-UB 25 1.5, MKTG-UB 20 2, ECON1-UC 301 4, CSCI-UA 4 4, THEA-UT 678 4, matched against the NYU Bulletin). All 389 Fall 2026 online and blended sections parsed.
- Asynchronous detection: no change needed. Across Fall 2026, all 125 sections without meeting times say "asynchronous" (82) or "Does Not Meet" (43); none are ambiguous. Two sections have meeting times plus an asynchronous component, and these are correctly judged on their meetings.
- Term ids come straight from NYU's dropdown — NYU lists the current term as `9999` ("Fall 2026"), not `1268`; following the dropdown keeps Takeable in step with the official search.
- Restriction phrases widened to include "restricted", "only" and "prerequisite". Excluded: "open to all" and "first-years and above". Real January notes such as "Pre-requisite: Law, Business, & Society" and "only Drama seniors will have priority" were otherwise missed; `prd.md > Takeability Verdict` updated.
- Independent-study sections are a Check ("you need a faculty sponsor first"). From Beijing, the only "Takeable" January section was an independent study with an empty note, which overstated what a student can just sign up for.
- Rows lead with the first reason that isn't a passing time, because the time column already shows it.
- The "nothing takeable" message measures start times around the middle of the student's class hours. Sorting raw clock times split overnight classes at midnight and produced "most start between 1:30 am and 10:30 pm"; it now reads "between 11:00 pm and 2:00 am in Beijing".
- Dates on the page are always formatted in US English. The browser's own locale had put Chinese dates into the English interface.
