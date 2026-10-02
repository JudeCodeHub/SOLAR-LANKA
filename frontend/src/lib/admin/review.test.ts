import assert from "node:assert/strict";
import test from "node:test";

import { accountProblem, accountRefusal, canDecide, refusalText, shortId } from "./review.ts";

const ID = "3f2b8c1e-0a4d-4f5e-9c7b-1d2e3f4a5b6c";

test("only a pending submission can be decided", () => {
  assert.equal(canDecide("pending"), true);
  for (const status of ["draft", "approved", "rejected", undefined]) assert.equal(canDecide(status), false);
});

test("a refused decision is explained from the company's current status", () => {
  assert.match(refusalText({ name: "Acme", publication_status: "approved" }), /Acme.*Approved/);
  assert.match(refusalText({ name: "Acme", publication_status: "rejected" }), /Acme.*Not approved/);
  assert.match(refusalText({ name: "Acme", publication_status: "draft" }), /Acme.*draft/i);
  assert.ok(refusalText(undefined));
});

test("an account id must be present and well formed", () => {
  assert.ok(accountProblem({ targetId: "", selfId: undefined, action: "suspend" }));
  assert.ok(accountProblem({ targetId: "abc", selfId: undefined, action: "suspend" }));
  assert.equal(accountProblem({ targetId: ID, selfId: undefined, action: "suspend" }), null);
});

test("an administrator cannot suspend themselves, but the check does not block restoring", () => {
  assert.ok(accountProblem({ targetId: ID.toUpperCase(), selfId: ID, action: "suspend" }));
  assert.equal(accountProblem({ targetId: ID, selfId: ID, action: "restore" }), null);
});

test("each action has its own conflict explanation", () => {
  assert.notEqual(accountRefusal("restore"), accountRefusal("suspend"));
});

test("ids are shortened for display", () => {
  assert.equal(shortId(ID), "3f2b8c1e");
});
