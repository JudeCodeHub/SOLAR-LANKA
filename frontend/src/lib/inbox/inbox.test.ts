import assert from "node:assert/strict";
import { test } from "node:test";

import { availableActions, companyStatusLabel, customerSees, isActive, noteAuthor, staleMessage } from "./inbox.ts";

const d = (status: string) => ({ status });

test("the company's own wording for each status, and unknown ones shown as written", () => {
  assert.equal(companyStatusLabel("submitted"), "New");
  assert.equal(companyStatusLabel("viewed"), "Opened");
  assert.equal(companyStatusLabel("responding"), "Responding");
  assert.equal(companyStatusLabel("closed"), "Closed");
  assert.equal(companyStatusLabel("cancelled"), "Withdrawn by the customer");
  assert.equal(companyStatusLabel("mystery"), "mystery");
});

test("what the customer sees matches their own request page wording", () => {
  assert.equal(customerSees("submitted"), "Delivered, not opened yet");
  assert.equal(customerSees("viewed"), "Opened");
  assert.equal(customerSees("responding"), "Preparing a response");
});

test("an enquiry is active until it is closed or withdrawn", () => {
  for (const s of ["submitted", "viewed", "responding"]) assert.equal(isActive(d(s)), true, s);
  for (const s of ["closed", "cancelled", "other"]) assert.equal(isActive(d(s)), false, s);
});

test("a new enquiry can be opened, responded to, closed and noted", () => {
  assert.deepEqual(availableActions(d("submitted")), { canMarkOpened: true, canMarkResponding: true, canClose: true, canAddNote: true, inactiveReason: null });
});

test("an opened enquiry can still be responded to but not re-opened", () => {
  const a = availableActions(d("viewed"));
  assert.equal(a.canMarkOpened, false);
  assert.equal(a.canMarkResponding, true);
});

test("once responding, progress cannot go backwards, but it can be closed and noted", () => {
  const a = availableActions(d("responding"));
  assert.equal(a.canMarkOpened, false);
  assert.equal(a.canMarkResponding, false);
  assert.equal(a.canClose, true);
  assert.equal(a.canAddNote, true);
});

test("a closed or withdrawn enquiry allows nothing and says why", () => {
  for (const [s, reason] of [["closed", "closed"], ["cancelled", "withdrawn"], ["x", "other"]] as const) {
    const a = availableActions(d(s));
    assert.equal(a.canMarkOpened || a.canMarkResponding || a.canClose || a.canAddNote, false, s);
    assert.equal(a.inactiveReason, reason, s);
  }
});

test("after a refusal the message comes from the fresh state", () => {
  assert.match(staleMessage(d("cancelled")), /withdrawn/i);
  assert.match(staleMessage(d("closed")), /closed/i);
  assert.match(staleMessage(d("responding")), /already responding/i);
  assert.match(staleMessage(undefined), /could not be done/i);
  assert.match(staleMessage(d("submitted")), /could not be done/i);
});

test("notes say whether the viewer wrote them and reveal nothing else", () => {
  assert.equal(noteAuthor("u1", "u1"), "You");
  assert.equal(noteAuthor("u2", "u1"), "A colleague");
  assert.equal(noteAuthor("u2", undefined), "A colleague");
});
