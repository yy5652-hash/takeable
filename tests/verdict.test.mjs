import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { judge } from "../public/core/verdict.js";

const snapshot = JSON.parse(readFileSync(new URL("../data/snapshots/1272.json", import.meta.url), "utf8"));
const byCode = (code) => {
  const s = snapshot.sections.find((x) => x.code === code);
  assert.ok(s, `${code} is in the January 2027 snapshot`);
  return s;
};
const situation = (tz, earliest = "08:00", latest = "23:00") => ({ homeSchool: "stern", tz, window: { earliest, latest } });
const BEIJING = situation("Asia/Shanghai");
const LONDON = situation("Europe/London");

test("TECH-UB 25 from Beijing: Not takeable, meets 10:00 pm – 2:00 am", () => {
  const { verdict, reasons } = judge(byCode("TECH-UB 25"), BEIJING);
  assert.equal(verdict, "no");
  assert.equal(reasons[0].kind, "time");
  assert.match(reasons[0].text, /10:00 pm – 2:00 am your time/);
});

test("TECH-UB 25 from London is never Not takeable for time", () => {
  const { reasons } = judge(byCode("TECH-UB 25"), LONDON);
  const time = reasons.find((r) => r.kind === "time");
  assert.equal(time.level, "pass");
  assert.match(time.text, /2:00 pm – 6:00 pm/);
});

test("THEA-UT 678 flips when the earliest start moves to 6:30 am in Beijing", () => {
  const thea = byCode("THEA-UT 678");
  assert.equal(judge(thea, BEIJING).reasons.find((r) => r.kind === "time").level, "fail");
  assert.equal(judge(thea, situation("Asia/Shanghai", "06:30")).reasons.find((r) => r.kind === "time").level, "pass");
});

test("Asynchronous sections pass on time from anywhere", () => {
  const time = judge(byCode("ECON1-UC 301"), BEIJING).reasons.find((r) => r.kind === "time");
  assert.equal(time.level, "pass");
  assert.match(time.text, /Asynchronous/);
});

test("ECON1-UC 301 for a Stern student: Not takeable, no Stern credit for SPS", () => {
  const { verdict, reasons } = judge(byCode("ECON1-UC 301"), BEIJING);
  assert.equal(verdict, "no");
  assert.equal(reasons[0].text, "No Stern credit for SPS courses");
});

test("TECH-UB 25 from London is Takeable or Check (its note has a restriction), never Not takeable", () => {
  const { verdict, reasons } = judge(byCode("TECH-UB 25"), LONDON);
  assert.notEqual(verdict, "no");
  assert.ok(reasons.some((r) => r.kind === "restriction" && /Do not enroll if/.test(r.text)));
});

test("THEA-UT 678 from Beijing with a 6:30 am start is Takeable or Check", () => {
  assert.equal(judge(byCode("THEA-UT 678"), BEIJING).verdict, "no");
  assert.notEqual(judge(byCode("THEA-UT 678"), situation("Asia/Shanghai", "06:30")).verdict, "no");
});

test("Liberal Studies asynchronous course: Check, not on Stern's approved list", () => {
  const { verdict, reasons } = judge(byCode("ENSTU-UF 101"), BEIJING);
  assert.equal(verdict, "check");
  assert.match(reasons[0].text, /isn't on Stern's approved list/);
});

test("Stern seniors-only course is a Check with the note quoted, not a guess about the student", () => {
  const { reasons } = judge(byCode("SOIM-UB 12"), LONDON);
  assert.ok(reasons.some((r) => r.kind === "restriction" && r.text.includes("Open to Stern seniors only.")));
});

test("Independent study needs a faculty sponsor, so it is a Check", () => {
  const ind = snapshot.sections.find((s) => /independent study/i.test(s.component));
  assert.ok(ind, "the snapshot has an independent study");
  assert.equal(judge(ind, BEIJING).verdict === "takeable", false);
});

test("0-credit sections are flagged", () => {
  const zero = snapshot.sections.find((s) => s.credits && s.credits.max === 0);
  assert.ok(judge(zero, LONDON).reasons.some((r) => r.kind === "credits"));
});

test("Reasons are ordered fail, then check, then pass", () => {
  const order = { fail: 0, check: 1, pass: 2 };
  for (const s of snapshot.sections) {
    const levels = judge(s, BEIJING).reasons.map((r) => order[r.level]);
    assert.deepEqual(levels, [...levels].sort((a, b) => a - b), s.code);
  }
});

test("Every section in the snapshot gets a verdict with at least one reason", () => {
  for (const s of snapshot.sections) {
    const { verdict, reasons } = judge(s, BEIJING);
    assert.ok(["takeable", "check", "no"].includes(verdict), s.code);
    assert.ok(reasons.length >= 1 && reasons.every((r) => r.text), s.code);
  }
});
