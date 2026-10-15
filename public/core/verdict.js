// Combines the reasons for one section into a verdict for one student's situation.
//   any "fail"  -> Not takeable
//   any "check" -> Check
//   otherwise   -> Takeable
import { NY_TZ, describeSchedule, fitsWindow, localSchedule } from "./time.js";
import { readNote } from "./notes.js";
import { creditReason } from "./schools.js";

export const VERDICTS = {
  takeable: { label: "Takeable", symbol: "✓" },
  check: { label: "Check", symbol: "?" },
  no: { label: "Not takeable", symbol: "✕" },
};
const LEVEL_ORDER = { fail: 0, check: 1, pass: 2 };
const KIND_ORDER = { time: 0, credit: 1, credits: 2, restriction: 3, details: 4 };

export function judge(section, situation) {
  const reasons = [timeReason(section, situation), creditReason(section, situation.homeSchool), ...noteReasons(section)];
  if (/independent study/i.test(section.component)) {
    reasons.push({ kind: "restriction", level: "check", text: "Independent study — you need a faculty sponsor first" });
  }
  if (section.credits && section.credits.max === 0) {
    reasons.push({ kind: "credits", level: "check", text: "0 credits — doesn't count toward your degree" });
  }
  if (section.detailsOk === false) {
    reasons.push({ kind: "details", level: "check", text: "Details unavailable from NYU — open the official listing" });
  }
  reasons.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  const verdict = reasons.some((r) => r.level === "fail") ? "no" : reasons.some((r) => r.level === "check") ? "check" : "takeable";
  return { verdict, reasons };
}

// Restrictions are quoted from NYU's note, never interpreted.
function noteReasons(section) {
  return readNote(section.note).restrictions.map((sentence) => ({
    kind: "restriction",
    level: "check",
    text: `Note: “${sentence}”`,
  }));
}

export function timeReason(section, situation) {
  const { tz, window } = situation;
  const away = tz !== NY_TZ;

  if (section.mode === "blended" && away) {
    return { kind: "time", level: "fail", text: `Partly in person (${section.campus || "New York"})` };
  }

  if (!section.meetings.length) {
    const note = readNote(section.note);
    if (note.async === true || /does not meet/i.test(section.meetsText)) {
      return { kind: "time", level: "pass", text: "Asynchronous — work on your own schedule" };
    }
    return { kind: "time", level: "check", text: "Meeting time not listed" };
  }

  const schedule = localSchedule(section, tz);
  const badFirst = schedule.first.filter((e) => !fitsWindow(e.local, window));
  const badLast = schedule.last.filter((e) => !fitsWindow(e.local, window));
  const shown = describeSchedule(schedule.first);
  const dst = schedule.dstShift ? ` (${describeSchedule(schedule.last)} after the clocks change)` : "";
  if (badFirst.length || badLast.length) {
    const worst = describeSchedule(badFirst.length ? badFirst : badLast);
    return { kind: "time", level: "fail", text: `Meets ${worst} your time${dst}`, schedule };
  }
  return { kind: "time", level: "pass", text: `Meets ${shown} your time${dst}`, schedule };
}
