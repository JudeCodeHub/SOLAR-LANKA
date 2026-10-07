import assert from "node:assert/strict";
import test from "node:test";

import { dayOf, groupOf, groupVisits } from "./schedule.ts";

// 2026-10-06 09:00 in Sri Lanka (UTC+5:30) is 03:30 UTC.
const NOW = Date.parse("2026-10-06T03:30:00Z");
const visit = (id: string, start: string | null) => ({ id, status: "confirmed", confirmed_starts_at: start, confirmed_ends_at: start });

test("a day is read in Sri Lanka time, not in UTC", () => {
  // 21:00 UTC on the 5th is 02:30 on the 6th in Colombo.
  assert.equal(dayOf("2026-10-05T21:00:00Z"), "2026-10-06");
  assert.equal(dayOf("2026-10-05T18:00:00Z"), "2026-10-05");
});

test("a visit is today, coming up or earlier by its day in Colombo", () => {
  assert.equal(groupOf(visit("a", "2026-10-06T10:00:00Z"), NOW), "today");
  assert.equal(groupOf(visit("b", "2026-10-05T21:00:00Z"), NOW), "today");
  assert.equal(groupOf(visit("c", "2026-10-07T04:00:00Z"), NOW), "upcoming");
  assert.equal(groupOf(visit("d", "2026-10-05T10:00:00Z"), NOW), "earlier");
  assert.equal(groupOf(visit("e", null), NOW), "upcoming");
});

test("today's visits come first in time order, coming ones soonest first, earlier ones newest first, and none is lost", () => {
  const all = [visit("late", "2026-10-06T11:00:00Z"), visit("soon", "2026-10-06T04:00:00Z"), visit("next", "2026-10-08T04:00:00Z"), visit("after", "2026-10-07T04:00:00Z"), visit("old", "2026-10-01T04:00:00Z"), visit("older", "2026-09-20T04:00:00Z"), visit("open", null)];
  const groups = groupVisits(all, NOW);
  assert.deepEqual(groups.today.map((v) => v.id), ["soon", "late"]);
  assert.deepEqual(groups.upcoming.map((v) => v.id), ["after", "next", "open"]);
  assert.deepEqual(groups.earlier.map((v) => v.id), ["old", "older"]);
  assert.equal(groups.today.length + groups.upcoming.length + groups.earlier.length, all.length);
});
