---
doc: prd
status: approved
---

# Takeable — Product Requirements

Takeable tells a US undergrad who will be away from campus which course sections they can actually take from where they'll be: on their clock, for credit at their home school, with the reasons shown. NYU is the first school.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

> As with scope, the learner asked the agent to make these product calls. They become the learner's decisions when this document is approved.

## The Core Journey
Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

1. The student opens Takeable in a browser. One page appears with a **situation bar** across the top:
   - Home school
   - Where I'll be (a city or time zone)
   - Term
   - My class hours: the earliest start and latest finish they'll accept, on their own clock
2. On first visit the bar is pre-filled:
   - Home school: Stern
   - Where I'll be: guessed from the computer's clock, labelled "guessed from your computer — change if you'll be elsewhere"
   - Term: the nearest upcoming term NYU has published
   - Class hours: 8:00 am to 11:00 pm
3. Takeable loads that term's undergraduate online and blended sections from NYU's public class search. A **summary strip** shows the counts: Takeable, Not takeable, Check, and "In-person sections hidden while you're away".
4. Below the strip is the **section list**, grouped Takeable first, then Check, then Not takeable. Each row shows:
   - Course code and title
   - School
   - Credits
   - Meeting time on the student's clock, with the original New York time in small text
   - A verdict chip
   - The single most important reason
5. The student types into **search** (code, title or subject) to narrow the list. Counts update.
6. The student clicks a row. A **detail panel** opens with every reason and its evidence:
   - The meeting pattern in New York time and local time
   - Session dates
   - Instruction mode
   - The section note, quoted
   - The credit rule, with a link to its source
   - The course description
7. The student clicks **Star** on sections they like. The **shortlist** (a side panel, or a bottom sheet on narrow screens) shows them with their verdicts, total credits, and a **Copy class numbers** button.
8. The student changes **Where I'll be** (for example Beijing → London) or **My class hours**. Every verdict, time and count updates immediately, with no reload. The shortlist keeps its stars and shows the new verdicts.
9. Success: within a minute the student knows which sections they can really take, why, and has the class numbers ready for registration.

## Screens and Layout
One page, no navigation:

- **Top:** the situation bar.
- **Under it:** the summary strip.
- **Main column:** search box, then the section list.
- **Right column:** the shortlist. On narrow screens it becomes a bottom sheet.
- **Detail panel:** slides over the right column. Esc or a close button returns to the shortlist.

## Look and Feel
Revised in the final review at the learner's request for a bolder visual design.
- **Departure board.** A dark navy header (the "board") holds:
  - the headline "Online doesn't mean you can take it."
  - the situation sentence with amber, underlined choices
  - live clocks for New York and the student's city, with a moon after 10 pm
  - a live world map of day and night: land as dots, the real terminator for the current moment, and pins for New York and the student's city joined by an arc
  - three large verdict count tiles that filter the list when clicked
- **A 24-hour bar on every course card**, on the student's clock:
  - night hours shaded
  - the student's class hours as a dashed green band
  - the class itself as a green block when it fits, red when it doesn't
  - asynchronous sections as a striped "anytime" line

  Seeing a red block at 2 am is the kernel at a glance.
- **Verdict colour plus symbol and word**, never colour alone. Takeable is ✓ green, Check is ? amber, Not takeable is ✕ red. Each card also carries a coloured edge stripe.
- **Detail panel** shows a seven-day chart of the student's week, then the exact times in both cities.
- **Shortlist styled as a boarding pass:** navy header, perforated divider, total credits in large figures.
- **Type:** Space Grotesk for headlines, Inter for text, JetBrains Mono for codes, times and counts. The fonts ship with the app, so the type is the same offline.
- **Light page under a dark board;** dark mode follows the system setting.
- **Not NYU-branded:** no logo, no violet. The footer credits NYU's public class search with the fetch time.
- **Copy tone:** plain and direct. "Outside your class hours (8:00 am – 11:00 pm)", "Meets 2:00 – 5:50 am your time".

## Features and Behavior

### Situation Bar
- **Home school:** "Stern (Undergraduate)" or "Another NYU school". For another school, credit is marked *Check — credit rules for your school aren't loaded yet*.
- **Where I'll be:** a short list of cities students commonly study from:
  - New York, London, Paris, Madrid, Florence, Berlin, Prague
  - Tel Aviv, Abu Dhabi, Accra
  - Beijing, Shanghai, Seoul, Tokyo, Sydney
  - Los Angeles, Buenos Aires, Mumbai, Singapore
  - Plus "Other time zone…", which offers every standard time zone.
- **Term:** the terms NYU's class search currently lists, newest first.
- **My class hours:** earliest start and latest finish, in half-hour steps.
- Choices persist when the student comes back.

- As an away student, I want to describe my situation once so that every result is judged for me.
  - [ ] On first visit the city is pre-filled from the computer's time zone, with the "guessed" label.
  - [ ] Changing any field re-sorts the list and updates counts without a page reload.
  - [ ] After closing and reopening the page, the same choices are restored.

### Takeability Verdict
Source: `scope.md > The Unique Kernel`.

Each section gets reasons in three areas. The overall verdict is:
- **Not takeable** if any reason is a hard fail.
- **Check** if there is no hard fail but at least one reason needs a human look.
- **Takeable** otherwise.

**Time on your clock**

| Situation | Verdict |
| --- | --- |
| Asynchronous (no meeting times, and the note says asynchronous or the section "Does Not Meet") | Pass: "Asynchronous — work on your own schedule" |
| Synchronous, every meeting inside the class-hours window | Pass: "Meets 6:30 – 10:15 am your time" |
| Synchronous, any meeting outside the window | Hard fail: "Meets 2:00 – 5:50 am your time" |
| Online, no meeting times, no asynchronous signal | Check: "Meeting time not listed" |
| Blended (online and in person) while away from New York | Hard fail: "Partly in person in New York" |

**Credit at home school** (Stern rule set; source: Stern's Minors and Electives page)

| Section offered by | Verdict |
| --- | --- |
| Stern | Pass: "Stern course" |
| An approved school: Arts & Science, Steinhardt, Tisch, Gallatin, Wagner, Silver, Tandon | Pass: "Counts as an outside elective (approved school: Tisch)". Tandon adds "talk to your adviser first", as the policy says. |
| School of Professional Studies | Hard fail: "No Stern credit for SPS courses" |
| Any other school or program | Check: "Not on Stern's approved list — ask your adviser" |
| 0 credits | Check: "0 credits" |

**Restrictions in the section note**

| Note says | Verdict |
| --- | --- |
| "open to … only", "students only", "standing or higher", "approval required", "permission", "do not enroll if", "does not count" | Check, with the note quoted. Takeable never guesses the student's class year or major. |
| "restricted", "only", "prerequisite" (but not "open to all" or "first-years and above") | Check, with the note quoted. |
| Component is Independent Study | Check: "Independent study — you need a faculty sponsor first" |

- As an away student, I want each section's verdict with its reasons so that I can trust it or check it myself.
  - [ ] Stern, Beijing, January 2027, hours 8:00 am – 11:00 pm: TECH-UB 25 shows ✕ Not takeable, "Meets 10:00 pm – 2:00 am your time".
  - [ ] Same setup: ECON1-UC 301 shows ✕ Not takeable, "No Stern credit for SPS courses".
  - [ ] Changing the city to London turns TECH-UB 25 to ✓ Takeable or ? Check (its note has a restriction), never ✕ for time.
  - [ ] Setting the earliest start to 6:30 am in Beijing turns THEA-UT 678 (6:30 – 10:15 am Beijing) from ✕ to ✓ or ?.
  - [ ] Every verdict chip has at least one visible reason; no verdict is shown without one.

### Section List and Search
- Rows grouped Takeable → Check → Not takeable. Within a group, sorted by course code.
- Search matches code, title or subject. Counts in the summary strip reflect the search.
  - [ ] Typing "TECH" leaves only TECH sections, and the counts change to match.

### Section Details
- Opens from any row. Shows everything in step 6 of the core journey; the quoted note is verbatim.
  - [ ] The local and New York times shown in the detail panel match the row.
  - [ ] The credit rule links to Stern's policy page.

### Shortlist
- Star or unstar from a row or the detail panel.
- Shows each starred section's verdict for the current situation, total credits (variable-credit sections show a range), and **Copy class numbers**, which copies the class numbers as a comma-separated list.
- Persists in the browser.
  - [ ] Starring two sections shows both, with total credits summed.
  - [ ] Copy class numbers puts, for example, "1258, 1441" on the clipboard and shows a "Copied" confirmation.
  - [ ] Stars survive a page reload.

### Data Freshness
- The footer shows "Live from NYU class search · fetched 3 min ago".
- If NYU's search can't be reached, Takeable uses the saved snapshot and shows a banner: "Couldn't reach NYU — showing saved data from Oct 15, 2026".
  - [ ] With the network off, the demo term still loads from the snapshot and shows the banner.

## States and Boundaries
- **First use:** pre-filled situation bar with the "guessed" label; the list loads straight away. There is no empty welcome screen.
- **Loading:** the summary strip shows "Checking N sections…" with a progress count while section details are fetched for the first time; later visits use the cache.
- **Nothing takeable:** a friendly empty state names the most common blocking reason (for example "Most sections meet between 1:00 am and 6:00 am your time") and offers to widen class hours.
- **Search matches nothing:** "No sections match 'xyz' this term."
- **NYU unreachable:** snapshot plus banner, as in Data Freshness. If there's no snapshot for that term either: "This term isn't available offline."
- **Persistence:** situation and stars are kept in this browser only. There are no accounts and nothing leaves the student's machine except requests to NYU's public search.
- **Hidden assumption:** NYU lists meeting times in New York time. Takeable converts them using the real session dates, so daylight-saving changes are handled.

## Product Decisions
The agent proposed these at the learner's request; approving this document accepts them.
- **One page, no navigation:** the whole answer should fit on one screen for the demo and for a hurried student.
- **Three verdicts, not a score:** students need a decision, and a "Check" bucket keeps the tool honest where the data can't decide.
- **Away-only list:** in-person sections are counted, not listed. The audience is students who aren't on campus, and listing hundreds of impossible rows buries the answer.
- **Stern as the one credit rule set:** it's the learner's own school, and its policy is published and unambiguous about SPS.
- **Restrictions are Check, never a guess:** Takeable doesn't know the student's year or major and won't pretend to.
- **Class numbers, not enrollment:** registration stays in NYU's own system.

## What We're Building
- Situation Bar
- Takeability Verdict
- Section List and Search
- Section Details
- Shortlist
- Data Freshness

Everything above, for NYU, with the Stern credit rule set, on any term NYU's public search lists.

## Deferred From the POC
- **Credit rules for other home schools:** each needs its own sourced policy; Stern proves the pattern.
- **Matching restrictions to the student's year and major:** needs a profile and careful parsing; Check is honest for now.
- **In-person sections at NYU global sites:** location codes need mapping; the remote case is the core.
- **Other universities:** need their own data adapters.

## Possible Later Enhancements
- Calendar export (.ics) of the shortlist in local time.
- Describing your situation in plain language.
- A shareable link that encodes the situation and shortlist.
- Public deployment.

## Non-Goals
- **Enrolling or logging in to Albert:** it needs credentials and there's no public API.
- **Prerequisite or degree-audit checks:** they need private records.
- **Seat availability or waitlist alerts:** not part of takeability.
- **An AI chat assistant:** verdicts must be deterministic and cite sources.
- **Predicting whether a course will be offered in future terms.**

## Open Questions
- Whether NYU's "hours" text always means credits (for example "4 Hour Lecture" = 4 credits): verify against a few known courses in the first build slice. Doesn't block spec.
- Whether every asynchronous section is marked consistently ("Does Not Meet", or a note saying asynchronous): the first slice checks this across a full term. Doesn't block spec.
