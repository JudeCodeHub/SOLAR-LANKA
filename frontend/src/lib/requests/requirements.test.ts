import assert from "node:assert/strict";
import { test } from "node:test";

import { lockedDistrict, requirementsDefaults, requirementsSchema, valuesFromDraft } from "./requirements.ts";

const id = "0b2f8a4e-5c1d-4f3a-9b7e-1a2b3c4d5e6f";
const valid = { ...requirementsDefaults, district: "Colombo", details: "  Need a 5 kW rooftop system.  " };

function problems(overrides: Record<string, string>) {
  const result = requirementsSchema.safeParse({ ...valid, ...overrides });
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
}

test("a valid form becomes the request fields: details trimmed, blank estimate and use are null", () => {
  const result = requirementsSchema.safeParse(valid);
  assert.ok(result.success);
  assert.deepEqual(result.data, {
    estimate_id: null,
    district: "Colombo",
    monthly_consumption_kwh: null,
    details: "Need a 5 kW rooftop system.",
  });
});

test("an estimate id and a monthly use are kept as typed", () => {
  const result = requirementsSchema.safeParse({ ...valid, estimate_id: id, monthly_consumption_kwh: " 320.5 " });
  assert.ok(result.success);
  assert.equal(result.data.estimate_id, id);
  assert.equal(result.data.monthly_consumption_kwh, "320.5");
});

test("a typed zero for monthly use stays zero, a blank is unknown", () => {
  const zero = requirementsSchema.safeParse({ ...valid, monthly_consumption_kwh: "0" });
  assert.ok(zero.success);
  assert.equal(zero.data.monthly_consumption_kwh, "0");
});

test("district and details are required", () => {
  assert.deepEqual(Object.keys(problems({ district: "", details: "   " })).sort(), ["details", "district"]);
});

test("a district outside the backend's list is refused", () => {
  assert.ok(problems({ district: "Atlantis" }).district);
});

test("details are limited to 4000 characters, exactly as the backend does", () => {
  assert.deepEqual(problems({ details: "a".repeat(4000) }), {});
  assert.ok(problems({ details: "a".repeat(4001) }).details);
});

test("an estimate id must be a real id, never arbitrary text", () => {
  for (const bad of ["abc", "../x", "<script>", `${id}x`]) assert.ok(problems({ estimate_id: bad }).estimate_id, bad);
});

test("monthly use follows the backend's limits", () => {
  for (const bad of ["-1", "abc", "1.2345", "1e3"]) assert.ok(problems({ monthly_consumption_kwh: bad }).monthly_consumption_kwh, bad);
});

test("editing a confirmed draft starts from its values", () => {
  const parsed = requirementsSchema.parse({ ...valid, estimate_id: id, monthly_consumption_kwh: "300" });
  assert.deepEqual(valuesFromDraft(parsed), { estimate_id: id, district: "Colombo", monthly_consumption_kwh: "300", details: "Need a 5 kW rooftop system." });
  assert.deepEqual(valuesFromDraft(requirementsSchema.parse(valid)), { estimate_id: "", district: "Colombo", monthly_consumption_kwh: "", details: "Need a 5 kW rooftop system." });
});

test("with an estimate the district is the estimate's, without one nothing is locked", () => {
  assert.equal(lockedDistrict({ inputs: { district: "Kandy" } }), "Kandy");
  assert.equal(lockedDistrict(undefined), null);
});
