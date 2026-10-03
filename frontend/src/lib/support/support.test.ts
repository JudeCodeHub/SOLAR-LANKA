import assert from "node:assert/strict";
import test from "node:test";

import { customerMoves, lookupQuery, ordered, staffMoves, stepsFromText, supportDestination } from "./support.ts";

test("staff move a case forward, and closing early needs a reason", () => {
  assert.deepEqual(staffMoves("open").map((m) => [m.to, m.needsReason]), [["in_progress", false], ["closed", true]]);
  assert.deepEqual(staffMoves("resolved").map((m) => [m.to, m.needsReason]), [["in_progress", false], ["closed", false]]);
  assert.deepEqual(staffMoves("closed"), []);
});

test("a customer can close a case or say a resolved one is not fixed", () => {
  assert.deepEqual(customerMoves("resolved").map((m) => m.to), ["open", "closed"]);
  assert.deepEqual(customerMoves("open").map((m) => m.to), ["closed"]);
  assert.deepEqual(customerMoves("closed"), []);
});

test("hazards are listed before routine observations", () => {
  const list = ordered([{ safety_level: "safe_observation", title: "B" }, { safety_level: "hazard", title: "Z" }, { safety_level: "safe_observation", title: "A" }]);
  assert.deepEqual(list.map((r) => r.title), ["Z", "A", "B"]);
});

test("a lookup is for an exact model or a chosen product, never both, and a blank model asks nothing", () => {
  assert.equal(lookupQuery({ model: "  ", code: "" }), null);
  assert.deepEqual(lookupQuery({ model: " GW3000 ", code: " E01 " }), { model: "GW3000", code: "E01" });
  assert.deepEqual(lookupQuery({ model: "ignored", code: "", productId: "p1" }), { product_id: "p1" });
});

test("steps are one per line with blanks dropped", () => {
  assert.deepEqual(stepsFromText(" a \n\n b\n  \n"), ["a", "b"]);
});

test("a support notification leads each person to their own side", () => {
  assert.equal(supportDestination([]), "/my/support");
  assert.equal(supportDestination(["technician"]), "/technician/support");
  assert.equal(supportDestination(["sales", "technician"]), "/company/support");
});
