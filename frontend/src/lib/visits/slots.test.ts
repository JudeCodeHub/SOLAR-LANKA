import assert from "node:assert/strict";
import test from "node:test";

import { canComplete, customerCan, emptyRow, formatRange, slotRequest, staffCan } from "./slots.ts";

test("complete rows become explicit slots with the Colombo offset", () => {
  const result = slotRequest([{ date: "2026-10-12", start: "09:00", end: "11:00" }]);
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.slots, [{ starts_at: "2026-10-12T09:00:00+05:30", ends_at: "2026-10-12T11:00:00+05:30" }]);
});

test("each missing or malformed field is named by row", () => {
  const result = slotRequest([emptyRow(), { date: "2026-10-12", start: "11:00", end: "09:00" }, { date: "12/10/2026", start: "9am", end: "10:00" }]);
  assert.ok(result.errors["0.date"] && result.errors["0.start"] && result.errors["0.end"]);
  assert.ok(result.errors["1.end"]);
  assert.ok(result.errors["2.date"] && result.errors["2.start"]);
  assert.deepEqual(result.slots, []);
});

test("no rows is an error", () => {
  assert.ok(slotRequest([]).errors.slots);
});

test("a range is shown in the visit's own zone", () => {
  const text = formatRange("2026-10-12T03:30:00Z", "2026-10-12T05:30:00Z", "Asia/Colombo");
  assert.match(text, /Monday, 12 October 2026/);
  assert.match(text, /09:00/);
  assert.match(text, /11:00/);
});

test("controls follow the backend's allowed actions", () => {
  assert.deepEqual(customerCan("alternatives_offered"), { accept: true, reschedule: true, cancel: true });
  assert.deepEqual(customerCan("completed"), { accept: false, reschedule: false, cancel: false });
  assert.deepEqual(staffCan("requested"), { confirm: true, propose: true, cancel: true });
  assert.deepEqual(staffCan("alternatives_offered"), { confirm: false, propose: false, cancel: true });
});

test("completion needs a confirmed visit that has started", () => {
  const now = Date.parse("2026-10-12T04:00:00Z");
  assert.equal(canComplete({ status: "confirmed", confirmed_starts_at: "2026-10-12T03:30:00Z" }, now), true);
  assert.equal(canComplete({ status: "confirmed", confirmed_starts_at: "2026-10-12T05:00:00Z" }, now), false);
  assert.equal(canComplete({ status: "completed", confirmed_starts_at: "2026-10-12T03:30:00Z" }, now), false);
});
