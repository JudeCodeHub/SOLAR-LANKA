import assert from "node:assert/strict";
import test from "node:test";

import { refusalText, REQUIRED_EVIDENCE, stepActions, validateComplete, validateReset, type StepRow } from "./staff.ts";

const steps: StepRow[] = [
  { id: "a", kind: "site_survey", position: 1, status: "completed" },
  { id: "b", kind: "system_design", position: 2, status: "in_progress" },
  { id: "c", kind: "permits_and_approvals", position: 3, status: "pending" },
];

test("only the first step or one after a completed step can start", () => {
  assert.equal(stepActions({ id: "x", kind: "site_survey", position: 1, status: "pending" }, []).start, "yes");
  const blocked = stepActions(steps[2]!, steps);
  assert.equal(blocked.start, "no");
  assert.equal(blocked.waitingFor, "System design");
  assert.equal(stepActions({ ...steps[2]!, position: 2 }, [steps[0]!]).start, "yes");
});

test("a step in progress can complete or be returned, and a completed step is final", () => {
  const active = stepActions(steps[1]!, steps);
  assert.deepEqual([active.complete, active.reset, active.final], [true, true, false]);
  assert.equal(stepActions(steps[0]!, steps).final, true);
});

test("completion needs a well-formed evidence reference", () => {
  assert.ok(validateComplete({ assetId: "", note: "" }).assetId);
  assert.ok(validateComplete({ assetId: "not-an-id", note: "" }).assetId);
  assert.deepEqual(validateComplete({ assetId: "3f2b8c1e-0a4d-4f5e-9c7b-1d2e3f4a5b6c", note: "" }), {});
});

test("returning a step to not started needs a reason", () => {
  assert.ok(validateReset({ reason: "   " }).reason);
  assert.deepEqual(validateReset({ reason: "Survey must be redone" }), {});
});

test("every step names exactly one required evidence kind", () => {
  assert.equal(Object.keys(REQUIRED_EVIDENCE).length, 8);
});

test("refusals are explained from the fresh step", () => {
  assert.match(refusalText("start", { ...steps[1]!, status: "completed" }, steps), /System design.*Completed/);
  assert.match(refusalText("start", steps[2]!, steps), /System design/);
  assert.match(refusalText("complete", steps[1]!, steps), /evidence/i);
  assert.ok(refusalText("reset", undefined, steps));
});
