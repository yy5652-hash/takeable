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

test("Every section in the snapshot gets a verdict with at least one reason", () => {
  for (const s of snapshot.sections) {
    const { verdict, reasons } = judge(s, BEIJING);
    assert.ok(["takeable", "check", "no"].includes(verdict), s.code);
    assert.ok(reasons.length >= 1 && reasons.every((r) => r.text), s.code);
  }
});
