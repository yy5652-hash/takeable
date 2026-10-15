---
doc: scope
status: approved
---

# Takeable

Takeable shows a US undergrad which courses they can actually take from wherever they'll be, using NYU as the first school.

> How this scope was made: the learner set the idea ("做一个美本 nyu为例子选课助手": a course-picking assistant for US undergrads, with NYU as the example). They then asked the agent to make the remaining scoping calls and present them for approval. The calls below are agent proposals until the learner approves this document.

## The Unique Kernel
**"Online" is not the same as "takeable."** For each course section, Takeable gives one verdict: *Takeable*, *Not takeable* or *Check*. The verdict comes with the reasons behind it. It joins three things that NYU's official class search keeps apart:

1. When the class really meets **on your clock**. A synchronous Zoom class at 1:00 pm in New York runs at 2:00 am in Beijing.
2. Whether your **home school gives credit** for it. Stern, for example, does not accept courses from the School of Professional Studies.
3. The **restrictions buried in the section notes**, such as "Open to Stern seniors only" or "Departmental approval required".

## Who It's For
An NYU Stern sophomore who will spend winter break in Beijing. They want to use the January 2027 term (Jan 4–15) to earn credit online.

Today they open NYU's public class search. It lists about 285 January sections, every time is in New York time, and the "Online" label doesn't say whether attendance is live. They click into each section one by one, convert times in their head, and cross-check a separate Stern policy page to see which schools count.

The same problem hits any student who is studying away, home for a break, or an international student in another time zone.

## The Core Loop
1. Open Takeable and say who you are and where you'll be: home school, city or time zone, term, and the hours you're willing to be in class.
2. The live section list sorts itself into Takeable, Not takeable and Check. Every row shows a one-line reason and the time converted to your clock.
3. Open a section to see the evidence: original New York time beside your local time, the quoted section note, and the credit rule with its source link.
4. Star the ones you want. The shortlist keeps them, adds up the credits, and copies the class numbers you'll type into the registration system.

You come back when plans change (a different city, a different term) or when you want to recheck before registration. Changing the city re-sorts everything at once.

## Inspiration & Identity
An airport departure board: you see your answer at a glance, with no digging. Calm and trustworthy, not playful. Every verdict shows its reason, so the student can trust it or check it.

Not NYU-branded: no logo and no violet theme. It names NYU only as the data source. Reference for the problem: NYU class search at https://bulletins.nyu.edu/class-search/.

## Why This Matters to the Learner
The learner is a US undergrad at NYU. The idea came from a real need: picking a winter-term course to take from abroad, where the official search answered none of the three questions above. They want the strongest possible hackathon entry, and practice working with an AI agent the way Claude's official courses teach it.

## What "Working" Looks Like
Run the app locally and open it in a browser. Choose Stern, Beijing, January 2027.

- Real NYU sections load from the public class search and sort into the three verdicts within seconds.
- **The "oh, that's cool" beat:** TECH-UB 25 is labelled *Online* by NYU, but Takeable marks it **Not takeable** ("Synchronous: meets 10:00 pm – 2:00 am in Beijing").
  - ECON1-UC 301 is asynchronous, but it is **Not takeable for credit**: Stern doesn't accept SPS courses, with a link to Stern's policy.
  - Switch the city to London, and several Stern and Tisch classes flip to **Takeable** at sensible afternoon hours.
- Star two courses. The shortlist shows the total credits and copies the class numbers.

## The POC Boundary
- One school's data: NYU, live from its public class search (no login), with a saved snapshot as a fallback.
- One home-school credit rule set: Stern undergrad, encoded from Stern's published policy and cited. Any other home school gets the time verdict, with credit marked *Check*.
- Sections a remote student could attend: online and blended undergraduate sections. In-person sections are counted, not listed.
- Verdict reasons: time on your clock against your class-hours window, synchronous or asynchronous status, home-school credit, and restriction notes quoted as *Check*.
- A shortlist saved in the browser.
- Runs locally. The demo is a screen recording.

## Later
- More home-school rule sets (CAS, Tisch, Steinhardt, and so on), then other US universities whose class search exposes similar public data.
- Matching restrictions to the student's class year and major, so "Open to seniors only" becomes a hard verdict instead of *Check*.
- In-person sections at the NYU global site where the student will be (for example NYU London).
- Calendar export (.ics) in local time.
- Typing your situation in plain language instead of filling a form.
- A public deployment so classmates can use it.

## Explicitly Cut
- **Logging in to NYU Albert or enrolling for the student.** It needs the student's credentials and there's no public API; the shortlist hands over class numbers instead.
- **Prerequisite checking against a transcript.** It needs private records.
- **Seat-availability alerts.** They need constant polling and aren't part of the takeability question.
- **An AI chat assistant.** The verdicts are deterministic and cite their sources. A chatbot would add cost and the risk of made-up answers to a decision students rely on.
