import assert from "node:assert/strict";
import { test } from "node:test";

import { parseEstimateParam, prepareHref } from "./prepare.ts";

const id = "0b2f8a4e-5c1d-4f3a-9b7e-1a2b3c4d5e6f";

test("the preparation address names the estimate and round-trips", () => {
  assert.equal(prepareHref(id), `/my/requests/new?estimate=${id}`);
  const parsed = parseEstimateParam(new URL(prepareHref(id), "http://x").searchParams.get("estimate"));
  assert.deepEqual(parsed, { kind: "ok", id });
});

test("a missing or blank estimate is none, anything unusable is invalid and never looked up", () => {
  assert.deepEqual(parseEstimateParam(null), { kind: "none" });
  assert.deepEqual(parseEstimateParam(undefined), { kind: "none" });
  assert.deepEqual(parseEstimateParam("   "), { kind: "none" });
  for (const bad of ["abc", "../account", "<script>", `${id}x`, "1", "' OR 1=1"]) {
    assert.deepEqual(parseEstimateParam(bad), { kind: "invalid" }, bad);
  }
});
