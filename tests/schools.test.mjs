import { test } from "node:test";
import assert from "node:assert/strict";
import { creditReason, schoolOf } from "../public/core/schools.js";

const sec = (code, extra = {}) => {
  const m = /^([A-Z0-9]+)-([A-Z]+)\s/.exec(code);
  return { code, subject: m[1], suffix: m[2], college: "", ...extra };
};

test("course-code suffix maps to the offering school", () => {
  assert.equal(schoolOf(sec("TECH-UB 25")).key, "stern");
  assert.equal(schoolOf(sec("ECON1-UC 301")).key, "sps");
  assert.equal(schoolOf(sec("THEA-UT 678")).key, "tisch");
  assert.equal(schoolOf(sec("UPADM-GP 101")).key, "wagner");
  assert.equal(schoolOf(sec("BUSF-SHU 101")).key, "shanghai");
  assert.equal(schoolOf(sec("FOO-QQ 1", { college: "Mystery School" })).name, "Mystery School");
});

test("Stern rules: SPS fails, approved schools pass, others need a check", () => {
  assert.equal(creditReason(sec("ECON1-UC 301"), "stern").level, "fail");
  assert.equal(creditReason(sec("ECON1-UC 301"), "stern").text, "No Stern credit for SPS courses");
  assert.equal(creditReason(sec("TECH-UB 25"), "stern").level, "pass");
  assert.match(creditReason(sec("SPAN-UA 401"), "stern").text, /Approved school for Stern electives \(Arts & Science\)/);
  assert.match(creditReason(sec("MG-UY 3724"), "stern").text, /talk to your adviser first/);
  assert.equal(creditReason(sec("ECI-UF 101"), "stern").level, "check");
  assert.match(creditReason(sec("ECON1-UC 301"), "stern").source.url, /stern\.nyu\.edu/);
});

test("another home school gets a credit check, never a guess", () => {
  const r = creditReason(sec("ECON1-UC 301"), "other");
  assert.equal(r.level, "check");
  assert.match(r.text, /aren't loaded yet/);
});
