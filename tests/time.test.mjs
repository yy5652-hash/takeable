import { test } from "node:test";
import assert from "node:assert/strict";
import { describeSchedule, fitsWindow, formatRange, localSchedule, toLocal, zonedToUtc } from "../public/core/time.js";

const WINDOW = { earliest: "08:00", latest: "23:00" };
const tech = {
  meetings: [0, 1, 2, 3, 4].map((day) => ({ day, start: "0900", end: "1300" })),
  startDate: "2027-01-04",
  endDate: "2027-01-14",
};

test("New York wall time becomes the right instant (EST in January)", () => {
  assert.equal(new Date(zonedToUtc("2027-01-04", "0900", "America/New_York")).toISOString(), "2027-01-04T14:00:00.000Z");
});

test("TECH-UB 25 from Beijing: 10:00 pm – 2:00 am, crosses midnight, outside 8 am – 11 pm", () => {
  const local = toLocal({ start: "0900", end: "1300" }, "2027-01-04", "Asia/Shanghai");
  assert.equal(formatRange(local), "10:00 pm – 2:00 am");
  assert.equal(local.crossesMidnight, true);
  assert.equal(fitsWindow(local, WINDOW), false);
});

test("TECH-UB 25 from London: 2:00 – 6:00 pm, inside the window", () => {
  const local = toLocal({ start: "0900", end: "1300" }, "2027-01-04", "Europe/London");
  assert.equal(formatRange(local), "2:00 pm – 6:00 pm");
  assert.equal(fitsWindow(local, WINDOW), true);
});

test("THEA-UT 678 from Beijing starts 6:30 am: fails at 8:00, fits from 6:30", () => {
  const local = toLocal({ start: "1730", end: "2115" }, "2027-01-05", "Asia/Shanghai");
  assert.equal(formatRange(local), "6:30 am – 10:15 am");
  assert.equal(fitsWindow(local, WINDOW), false);
  assert.equal(fitsWindow(local, { earliest: "06:30", latest: "23:00" }), true);
});

test("Fall term: New York leaves daylight saving on Nov 1, 2026, so Beijing time shifts an hour", () => {
  const before = toLocal({ start: "0930", end: "1045" }, "2026-10-26", "Asia/Shanghai");
  const after = toLocal({ start: "0930", end: "1045" }, "2026-11-02", "Asia/Shanghai");
  assert.equal(formatRange(before), "9:30 pm – 10:45 pm");
  assert.equal(formatRange(after), "10:30 pm – 11:45 pm");
});

test("Schedule description groups days and flags a daylight-saving shift", () => {
  const jan = localSchedule(tech, "Asia/Shanghai");
  assert.equal(describeSchedule(jan.first), "Mon–Fri 10:00 pm – 2:00 am");
  assert.equal(jan.dstShift, false);
  const fall = localSchedule({ meetings: [{ day: 0, start: "0930", end: "1045" }], startDate: "2026-09-02", endDate: "2026-12-14" }, "Asia/Shanghai");
  assert.equal(fall.dstShift, true);
});

test("Ending exactly at local midnight fits a window that runs to midnight", () => {
  const local = toLocal({ start: "1000", end: "1100" }, "2027-01-04", "Asia/Shanghai"); // 11 pm – 12 am
  assert.equal(fitsWindow(local, { earliest: "08:00", latest: "24:00" }), true);
  assert.equal(fitsWindow(local, WINDOW), false);
});
