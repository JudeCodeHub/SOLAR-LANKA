import assert from "node:assert/strict";
import { test } from "node:test";

import { countDeliveries, deliveryStatusLabel, headline, requestChip, requestStatusLabel, staleMessage, withdrawal } from "./progress.ts";

const d = (status: string, viewed: string | null = null) => ({
  id: status + Math.random(),
  company_id: "c" + status,
  status,
  created_at: "2026-10-01T10:00:00Z",
  viewed_at: viewed,
});
const req = (status: string, ...deliveries: string[]) => ({ status, deliveries: deliveries.map((s) => d(s)) });

test("statuses have plain wording and an unknown one is shown as written", () => {
  assert.equal(requestStatusLabel("submitted"), "Sent");
  assert.equal(requestStatusLabel("cancelled"), "Withdrawn");
  assert.equal(deliveryStatusLabel("submitted"), "Delivered, not opened yet");
  assert.equal(deliveryStatusLabel("responding"), "Preparing a response");
  assert.equal(deliveryStatusLabel("mystery"), "mystery");
});

test("deliveries are counted by stage", () => {
  assert.deepEqual(countDeliveries(req("submitted", "submitted", "viewed", "responding", "closed", "cancelled").deliveries), {
    total: 5, waiting: 1, opened: 1, responding: 1, closed: 1, cancelled: 1,
  });
});

test("the headline says where the request stands", () => {
  assert.equal(headline(req("submitted", "submitted", "submitted")), "No company has opened your request yet.");
  assert.equal(headline(req("submitted", "viewed", "submitted", "submitted")), "1 of 3 companies have opened your request.");
  assert.equal(headline(req("submitted", "viewed")), "1 of 1 company has opened your request.");
  assert.equal(headline(req("submitted", "responding", "viewed")), "1 company is preparing a response.");
  assert.equal(headline(req("submitted", "responding", "responding")), "2 companies are preparing a response.");
  assert.equal(headline(req("cancelled", "cancelled")), "You withdrew this request. Companies can no longer see it.");
  assert.equal(headline(req("closed", "closed")), "This request is closed.");
});

test("an active request nobody has responded to can be withdrawn, even if some have opened it", () => {
  assert.deepEqual(withdrawal(req("submitted", "submitted", "viewed")), { eligible: true });
});

test("a company response, a closed or an already withdrawn request cannot be withdrawn, each with its own reason", () => {
  assert.deepEqual(withdrawal(req("submitted", "viewed", "responding")), { eligible: false, reason: "responding" });
  assert.deepEqual(withdrawal(req("submitted", "closed")), { eligible: false, reason: "responding" });
  assert.deepEqual(withdrawal(req("cancelled", "cancelled")), { eligible: false, reason: "withdrawn" });
  assert.deepEqual(withdrawal(req("closed", "closed")), { eligible: false, reason: "closed" });
  assert.deepEqual(withdrawal(req("weird")), { eligible: false, reason: "other" });
});

test("after a refused withdrawal the message comes from the fresh state, not the error text", () => {
  assert.match(staleMessage(req("submitted", "responding")), /just started responding/);
  assert.match(staleMessage(req("cancelled", "cancelled")), /already been withdrawn/);
  assert.match(staleMessage(req("closed", "closed")), /closed in the meantime/);
  assert.match(staleMessage(undefined), /could not be withdrawn/);
  // Still eligible on fresh data (the refusal was something else): a general message.
  assert.match(staleMessage(req("submitted", "submitted")), /could not be withdrawn/);
});

test("the chip shows sent, preparing a response, closed or withdrawn, with a tone for each", () => {
  assert.deepEqual(requestChip(req("submitted", "submitted", "viewed")), { label: "Sent", tone: "info", state: "sent" });
  assert.deepEqual(requestChip(req("submitted", "viewed", "responding")), { label: "Preparing a response", tone: "success", state: "responding" });
  assert.deepEqual(requestChip(req("closed", "closed")), { label: "Closed", tone: "neutral", state: "closed" });
  assert.deepEqual(requestChip(req("cancelled", "cancelled")), { label: "Withdrawn", tone: "neutral", state: "withdrawn" });
  assert.equal(requestChip(req("something_new")).label, "something_new");
});
