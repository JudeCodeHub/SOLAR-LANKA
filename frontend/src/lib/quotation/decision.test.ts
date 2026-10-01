import assert from "node:assert/strict";
import test from "node:test";

import { decisionBlocker } from "./decision.ts";

const NOW = Date.parse("2026-10-01T00:00:00Z");
const base = { requestStatus: "submitted", quotationId: "q1", revisionId: "r1", now: NOW };
const offer = (over: object = {}) => ({ quotation_id: "q1", revision_id: "r1", status: "sent", valid_until: "2026-11-01T00:00:00Z", ...over });

test("an active latest revision can be decided", () => {
  assert.equal(decisionBlocker({ ...base, offers: [offer()] }), null);
});

test("a newer revision blocks the exact older one", () => {
  assert.equal(decisionBlocker({ ...base, offers: [offer({ revision_id: "r2" })] }), "replaced");
});

test("expiry is judged by the clock even when the stored status says sent", () => {
  assert.equal(decisionBlocker({ ...base, offers: [offer({ valid_until: "2026-09-30T00:00:00Z" })] }), "expired");
});

test("withdrawn, declined and accepted offers are each named", () => {
  for (const status of ["withdrawn", "declined", "accepted"]) {
    assert.equal(decisionBlocker({ ...base, offers: [offer({ status })] }), status);
  }
});

test("another accepted offer blocks this one", () => {
  const other = offer({ quotation_id: "q2", revision_id: "r9", status: "accepted" });
  assert.equal(decisionBlocker({ ...base, offers: [offer(), other] }), "other_accepted");
});

test("an inactive request blocks everything", () => {
  assert.equal(decisionBlocker({ ...base, requestStatus: "cancelled", offers: [offer()] }), "request_ended");
});
