import assert from "node:assert/strict";
import test from "node:test";

import { scheduleBody, validateInstallationNote, validateSchedule } from "./schedule.ts";

const NOW = Date.parse("2026-10-10T12:00:00Z");
const ok = { reason: "Waiting for roof access", nextAction: "Rebook the survey", delayDate: "" };

test("a reason and a next action or a delay are required", () => {
  assert.deepEqual(validateSchedule(ok, NOW), {});
  assert.ok(validateSchedule({ ...ok, reason: "  " }, NOW).reason);
  assert.ok(validateSchedule({ ...ok, nextAction: "" }, NOW).nextAction);
  assert.deepEqual(validateSchedule({ ...ok, nextAction: "", delayDate: "2026-10-20" }, NOW), {});
});

test("a delay must be a real date after today", () => {
  assert.ok(validateSchedule({ ...ok, delayDate: "2026-10-10" }, NOW).delayDate);
  assert.ok(validateSchedule({ ...ok, delayDate: "2026-09-01" }, NOW).delayDate);
  assert.ok(validateSchedule({ ...ok, delayDate: "10/20/2026" }, NOW).delayDate);
  assert.equal(validateSchedule({ ...ok, delayDate: "2026-10-11" }, NOW).delayDate, undefined);
});

test("over-long text is refused", () => {
  assert.ok(validateSchedule({ ...ok, reason: "x".repeat(1001) }, NOW).reason);
  assert.ok(validateSchedule({ ...ok, nextAction: "x".repeat(1001) }, NOW).nextAction);
});

test("the request carries trimmed text and a timezone-aware delay, and omits what is empty", () => {
  assert.deepEqual(scheduleBody({ reason: " r ", nextAction: " n ", delayDate: "2026-10-20" }), {
    reason: "r",
    next_action: "n",
    delay_until: "2026-10-20T00:00:00Z",
  });
  assert.deepEqual(scheduleBody({ reason: "r", nextAction: "", delayDate: "2026-10-20" }), { reason: "r", delay_until: "2026-10-20T00:00:00Z" });
});

test("an internal note needs text within the backend limit", () => {
  assert.ok(validateInstallationNote("   "));
  assert.ok(validateInstallationNote("x".repeat(2001)));
  assert.equal(validateInstallationNote("Large dog on site"), null);
});
