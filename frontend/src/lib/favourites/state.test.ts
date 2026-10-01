import assert from "node:assert/strict";
import { test } from "node:test";

import { applyFavourite, wouldExceedLimit } from "./state.ts";

test("saving puts the product first and never duplicates it", () => {
  assert.deepEqual(applyFavourite(["a", "b"], "c", true), ["c", "a", "b"]);
  assert.deepEqual(applyFavourite(["a", "b"], "b", true), ["b", "a"]); // moved up, not repeated
  assert.deepEqual(applyFavourite([], "a", true), ["a"]);
});

test("removing takes the product out and tolerates one that is not there", () => {
  assert.deepEqual(applyFavourite(["a", "b", "c"], "b", false), ["a", "c"]);
  assert.deepEqual(applyFavourite(["a"], "z", false), ["a"]);
  assert.deepEqual(applyFavourite([], "a", false), []);
});

test("the original list is never changed", () => {
  const original = ["a", "b"];
  applyFavourite(original, "c", true);
  applyFavourite(original, "a", false);
  assert.deepEqual(original, ["a", "b"]);
});

test("only a genuinely new product can exceed the limit", () => {
  assert.equal(wouldExceedLimit(["a", "b"], "c", 2), true);
  assert.equal(wouldExceedLimit(["a", "b"], "a", 2), false); // already saved
  assert.equal(wouldExceedLimit(["a"], "c", 2), false);
  assert.equal(wouldExceedLimit([], "c", 0), true);
});
