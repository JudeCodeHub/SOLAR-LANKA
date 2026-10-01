import assert from "node:assert/strict";
import test from "node:test";

import { currentStepText, progressText } from "./progress.ts";

test("progress counts completed steps and says when everything is done", () => {
  assert.equal(progressText(3, 8), "3 of 8 steps complete");
  assert.equal(progressText(8, 8), "All steps complete");
  assert.equal(progressText(0, 0), "0 of 0 steps complete");
});

test("the current step is the one in progress, whatever order the steps arrive in", () => {
  const steps = [
    { kind: "system_design", position: 2, status: "in_progress" },
    { kind: "site_survey", position: 1, status: "completed" },
    { kind: "permits_and_approvals", position: 3, status: "pending" },
  ];
  assert.equal(currentStepText(steps), "Now: System design");
});

test("with nothing in progress the next waiting step is named, and finished work says so", () => {
  assert.equal(currentStepText([{ kind: "site_survey", position: 1, status: "pending" }]), "Next: Site survey");
  assert.equal(currentStepText([{ kind: "site_survey", position: 1, status: "completed" }]), "All steps complete");
  assert.equal(currentStepText([]), "No steps have been set up yet.");
});
