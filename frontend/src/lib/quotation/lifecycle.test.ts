import assert from "node:assert/strict";
import { test } from "node:test";

import { actionsFor, effectiveStatus, explain, type RevisionLike, staleMessage, statusLabel, totalChange, workspaceState } from "./lifecycle.ts";

const NOW = Date.parse("2026-10-10T00:00:00Z");
const rev = (n: number, status: string, extra: Partial<RevisionLike> = {}): RevisionLike => ({
  id: `r${n}`, revision_number: n, status, sent_at: status === "draft" ? null : "2026-10-01T00:00:00Z", valid_until: status === "sent" ? "2026-11-01T00:00:00Z" : null, total: "100.00", ...extra,
});

test("no revisions means no quotation", () => assert.deepEqual(workspaceState([], NOW), { kind: "none" }));

test("a lone draft is a draft with nothing sent", () => {
  const s = workspaceState([rev(1, "draft")], NOW);
  assert.equal(s.kind, "draft");
  assert.ok(s.kind === "draft" && s.sent === null);
});

test("a sent, unexpired revision is live and frozen", () => assert.equal(workspaceState([rev(1, "sent")], NOW).kind, "sent"));

test("a sent revision past its valid-until time is expired even though its status still says sent", () => {
  const old = rev(1, "sent", { valid_until: "2026-10-05T00:00:00Z" });
  assert.equal(effectiveStatus(old, NOW), "expired");
  assert.equal(workspaceState([old], NOW).kind, "expired");
  assert.equal(statusLabel(old, NOW), "Expired");
});

test("a revision draft over a live sent revision keeps both in view", () => {
  const s = workspaceState([rev(2, "draft"), rev(1, "sent")], NOW);
  assert.ok(s.kind === "draft" && s.sent?.revision_number === 1);
  assert.match(explain(s), /Revision 1 is still what the customer sees/);
});

test("discarding the revision draft leaves the sent revision live (the withdrawn draft is the latest)", () => {
  const s = workspaceState([rev(2, "withdrawn", { sent_at: null }), rev(1, "sent")], NOW);
  assert.equal(s.kind, "sent");
});

test("replaced revisions are history, the newest sent one is live", () => {
  const s = workspaceState([rev(2, "sent"), rev(1, "revised")], NOW);
  assert.ok(s.kind === "sent" && s.revision.revision_number === 2);
});

test("accepted and declined offers are final", () => {
  assert.equal(workspaceState([rev(1, "accepted")], NOW).kind, "accepted");
  assert.equal(workspaceState([rev(1, "declined")], NOW).kind, "declined");
});

test("a withdrawn offer that had been sent cannot be restarted, one never sent can", () => {
  assert.equal(workspaceState([rev(1, "withdrawn")], NOW).kind, "withdrawn-sent");
  assert.equal(workspaceState([rev(1, "withdrawn", { sent_at: null })], NOW).kind, "withdrawn-draft");
});

test("actions follow the state: send or discard a draft, revise or withdraw a live offer, restart a discarded draft", () => {
  assert.deepEqual(actionsFor(workspaceState([rev(1, "draft")], NOW), true), { canSend: true, canDiscardDraft: true, canRevise: false, canWithdraw: false, canStartNew: false });
  assert.deepEqual(actionsFor(workspaceState([rev(1, "sent")], NOW), true), { canSend: false, canDiscardDraft: false, canRevise: true, canWithdraw: true, canStartNew: false });
  assert.equal(actionsFor(workspaceState([rev(1, "withdrawn", { sent_at: null })], NOW), true).canStartNew, true);
});

test("a revision draft over a live offer cannot withdraw the live offer (the backend refuses it)", () => {
  const a = actionsFor(workspaceState([rev(2, "draft"), rev(1, "sent")], NOW), true);
  assert.equal(a.canWithdraw, false);
  assert.equal(a.canSend, true);
});

test("nothing is allowed once the offer is final, expired, or the enquiry is no longer active", () => {
  const none = { canSend: false, canDiscardDraft: false, canRevise: false, canWithdraw: false, canStartNew: false };
  for (const status of ["accepted", "declined"]) assert.deepEqual(actionsFor(workspaceState([rev(1, status)], NOW), true), none);
  assert.deepEqual(actionsFor(workspaceState([rev(1, "sent", { valid_until: "2026-10-05T00:00:00Z" })], NOW), true), none);
  assert.deepEqual(actionsFor(workspaceState([rev(1, "draft")], NOW), false), none);
  assert.deepEqual(actionsFor(workspaceState([rev(1, "sent")], NOW), false), none);
});

test("after a refusal the message comes from the fresh state", () => {
  assert.match(staleMessage(workspaceState([rev(1, "sent")], NOW)), /already been sent/i);
  assert.match(staleMessage(workspaceState([rev(1, "withdrawn")], NOW)), /withdrawn/i);
  assert.match(staleMessage(workspaceState([rev(1, "accepted")], NOW)), /decided/i);
  assert.match(staleMessage(workspaceState([rev(1, "draft")], NOW)), /draft/i);
});

test("a changed total is described, an unchanged or missing one is not", () => {
  assert.equal(totalChange("100.00", "250.50"), "Total changed from LKR 100.00 to LKR 250.50");
  assert.equal(totalChange("100.00", "100.00"), null);
  assert.equal(totalChange(null, "100.00"), null);
});
