import { test } from "node:test";
import assert from "node:assert/strict";
import { readNote } from "../public/core/notes.js";

test("asynchronous notes", () => {
  assert.equal(readNote("ONLINE ASYNCHRONOUS COURSE").async, true);
  assert.equal(readNote("Meets asynchronously.").async, true);
});

test("synchronous signals win over an asynchronous component", () => {
  assert.equal(readNote("Open to first-years and above. Synchronous attendance is required.").async, false);
  assert.equal(readNote("This course will meet weekly via ZOOM, but there will also be an additional asynchronous component.").async, false);
  assert.equal(readNote("").async, null);
});

test("restrictions are quoted sentence by sentence; open-to-all is not a restriction", () => {
  const n = readNote("Open to Stern seniors only. Pre-requisite: Law, Business, & Society (SOIM-UB 6) Synchronous attendance is required.");
  assert.deepEqual(n.restrictions, ["Open to Stern seniors only.", "Pre-requisite: Law, Business, & Society (SOIM-UB 6) Synchronous attendance is required."]);
  assert.deepEqual(readNote("This section is open to all undergraduate students. This class will meet weekly via ZOOM.").restrictions, []);
  assert.deepEqual(readNote("Open to first-years and above. Synchronous attendance is required.").restrictions, []);
  assert.deepEqual(readNote("Do not enroll if you have already completed TECH-UB 23 (same course material).").restrictions.length, 1);
});
