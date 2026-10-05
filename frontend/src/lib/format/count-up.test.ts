import assert from "node:assert/strict";
import test from "node:test";

import { countAt, formatNumber } from "./count-up.ts";

test("numbers are written with commas and a fixed number of decimals", () => {
  assert.equal(formatNumber(7300), "7,300");
  assert.equal(formatNumber(1234567), "1,234,567");
  assert.equal(formatNumber(5.4, 1), "5.4");
  assert.equal(formatNumber(5, 1), "5.0");
  assert.equal(formatNumber(0), "0");
  assert.equal(formatNumber(999), "999");
  assert.equal(formatNumber(-1500.5, 1), "-1,500.5");
});

test("the count starts at zero, ends exactly on the target, and slows down towards the end", () => {
  assert.equal(countAt(7300, 0), 0);
  assert.equal(countAt(7300, 1), 7300);
  assert.equal(countAt(7300, 2), 7300);
  assert.equal(countAt(7300, -1), 0);
  const early = countAt(100, 0.25) - countAt(100, 0);
  const late = countAt(100, 1) - countAt(100, 0.75);
  assert.ok(early > late, "an ease-out moves fastest at the start");
});
