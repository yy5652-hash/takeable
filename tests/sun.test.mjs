import { test } from "node:test";
import assert from "node:assert/strict";
import { subsolarPoint, sunElevation, terminatorLat } from "../public/core/sun.js";

const FIRST_CLASS = Date.UTC(2027, 0, 4, 14, 0); // Jan 4, 2027, 9:00 a.m. in New York

test("subsolar point on Jan 4, 2027 at 14:00 UTC: southern-summer declination, over the mid-Atlantic", () => {
  const sun = subsolarPoint(FIRST_CLASS);
  assert.ok(Math.abs(sun.lat - -22.7) < 0.3, `declination ${sun.lat}`);
  assert.ok(Math.abs(sun.lon - -28.9) < 1.0, `longitude ${sun.lon}`);
});

test("June solstice noon at Greenwich: sun near 23.4°N over the prime meridian", () => {
  const sun = subsolarPoint(Date.UTC(2026, 5, 21, 12, 0));
  assert.ok(Math.abs(sun.lat - 23.43) < 0.1, `declination ${sun.lat}`);
  assert.ok(Math.abs(sun.lon) < 1.0, `longitude ${sun.lon}`);
});

test("at the first class: day in New York and London, night in Beijing", () => {
  const sun = subsolarPoint(FIRST_CLASS);
  assert.ok(sunElevation(40.71, -74.01, sun) > 0, "New York");
  assert.ok(sunElevation(51.51, -0.13, sun) > 0, "London");
  assert.ok(sunElevation(39.9, 116.4, sun) < 0, "Beijing");
});

test("the terminator in January leaves the Arctic dark at local noon", () => {
  const sun = subsolarPoint(FIRST_CLASS);
  const lat = terminatorLat(sun.lon, sun);
  assert.ok(lat > 60 && lat < 70, `terminator at the subsolar meridian ${lat}`);
  assert.ok(sunElevation(lat + 1, sun.lon, sun) < 0.5 && sunElevation(lat - 1, sun.lon, sun) > -0.5);
});
