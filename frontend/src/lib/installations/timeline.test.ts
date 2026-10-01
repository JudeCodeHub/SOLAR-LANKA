import assert from "node:assert/strict";
import test from "node:test";

import { isStatusChange, scheduleFor, updatesFor, type UpdateLike } from "./timeline.ts";

const entry = (over: Partial<UpdateLike>): UpdateLike => ({
  id: "a", milestone_id: "m1", created_at: "2026-10-01T00:00:00Z", from_status: "pending", to_status: "pending",
  reason: null, next_action: null, delay_until: null, ...over,
});
const NOW = Date.parse("2026-10-10T00:00:00Z");

test("updates are grouped by step and newest first", () => {
  const history = [entry({ id: "1" }), entry({ id: "2", created_at: "2026-10-03T00:00:00Z" }), entry({ id: "3", milestone_id: "m2" })];
  assert.deepEqual(updatesFor(history, "m1").map((e) => e.id), ["2", "1"]);
  assert.deepEqual(updatesFor(history, "m2").map((e) => e.id), ["3"]);
});

test("the schedule comes from the newest entry that sets a delay or a next action", () => {
  const updates = updatesFor(
    [entry({ id: "1", next_action: "Survey on site", created_at: "2026-10-02T00:00:00Z" }), entry({ id: "2", from_status: "pending", to_status: "in_progress", created_at: "2026-10-05T00:00:00Z" })],
    "m1",
  );
  assert.deepEqual(scheduleFor(updates, NOW), { nextAction: "Survey on site", delayUntil: null, delayed: false });
});

test("a delay is current only while its date is ahead", () => {
  const future = updatesFor([entry({ delay_until: "2026-10-20T00:00:00Z" })], "m1");
  const past = updatesFor([entry({ delay_until: "2026-10-05T00:00:00Z" })], "m1");
  assert.equal(scheduleFor(future, NOW)?.delayed, true);
  assert.equal(scheduleFor(past, NOW)?.delayed, false);
});

test("no schedule update means no schedule, and a blank next action does not count", () => {
  assert.equal(scheduleFor([], NOW), null);
  assert.equal(scheduleFor([entry({ next_action: "   " })], NOW), null);
});

test("a same-status entry is a shared note, not a status change", () => {
  assert.equal(isStatusChange(entry({})), false);
  assert.equal(isStatusChange(entry({ to_status: "completed" })), true);
});
