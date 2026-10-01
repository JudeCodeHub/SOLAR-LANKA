import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildRequestBody,
  type EligibleCompany,
  fingerprintOf,
  mayHaveBeenReceived,
  resolveRecipients,
  toggleRecipient,
} from "./recipients.ts";
import { requirementsSchema } from "./requirements.ts";

const req = requirementsSchema.parse({
  estimate_id: "0b2f8a4e-5c1d-4f3a-9b7e-1a2b3c4d5e6f",
  district: "Colombo",
  monthly_consumption_kwh: "320",
  details: "Need a system.",
});
const company = (id: string): EligibleCompany => ({
  id,
  name: `Company ${id}`,
  service_districts: ["Colombo"],
  services: ["installation"],
  declared_credentials: [],
});

test("a company is added and removed by choosing it again; nothing starts chosen", () => {
  assert.deepEqual(toggleRecipient([], "a"), { outcome: "added", ids: ["a"] });
  assert.deepEqual(toggleRecipient(["a", "b"], "a"), { outcome: "removed", ids: ["b"] });
});

test("a sixth company is refused and the list is untouched", () => {
  const five = ["1", "2", "3", "4", "5"];
  const result = toggleRecipient(five, "6");
  assert.equal(result.outcome, "full");
  assert.deepEqual(result.ids, five);
  assert.notEqual(result.ids, five, "returns a copy, not the input");
  // Removing one when full still works.
  assert.equal(toggleRecipient(five, "3").outcome, "removed");
});

test("a company can never be chosen twice", () => {
  let ids: string[] = [];
  for (let i = 0; i < 4; i += 1) ids = toggleRecipient(ids, "a").ids;
  assert.ok(ids.length <= 1);
});

test("chosen companies that are no longer eligible are reported, the rest keep their order", () => {
  const resolved = resolveRecipients(["b", "x", "a"], [company("a"), company("b")]);
  assert.deepEqual(resolved.listed.map((c) => c.id), ["b", "a"]);
  assert.deepEqual(resolved.missing, ["x"]);
});

test("the request body carries exactly the requirements and the chosen companies", () => {
  assert.deepEqual(buildRequestBody(req, ["a", "b"]), {
    district: "Colombo",
    details: "Need a system.",
    monthly_consumption_kwh: "320",
    saved_estimate_id: "0b2f8a4e-5c1d-4f3a-9b7e-1a2b3c4d5e6f",
    company_ids: ["a", "b"],
  });
});

test("unknown monthly use and no estimate are sent as null, never 0", () => {
  const bare = requirementsSchema.parse({ estimate_id: "", district: "Kandy", monthly_consumption_kwh: "", details: "x" });
  const body = buildRequestBody(bare, ["a"]);
  assert.equal(body.monthly_consumption_kwh, null);
  assert.equal(body.saved_estimate_id, null);
});

test("the same content has the same fingerprint whatever order companies were chosen in", () => {
  assert.equal(fingerprintOf(req, ["a", "b"]), fingerprintOf(req, ["b", "a"]));
});

test("any change to the content changes the fingerprint", () => {
  const base = fingerprintOf(req, ["a", "b"]);
  assert.notEqual(base, fingerprintOf(req, ["a"]));
  assert.notEqual(base, fingerprintOf({ ...req, details: "Other." }, ["a", "b"]));
  assert.notEqual(base, fingerprintOf({ ...req, district: "Kandy" }, ["a", "b"]));
  assert.notEqual(base, fingerprintOf({ ...req, monthly_consumption_kwh: "321" }, ["a", "b"]));
  assert.notEqual(base, fingerprintOf({ ...req, estimate_id: null }, ["a", "b"]));
});

test("failures that may have reached the server are told apart from those that did not", () => {
  for (const status of [0, 500, 502, 503, 504]) assert.equal(mayHaveBeenReceived(status), true, String(status));
  for (const status of [400, 404, 409, 422, 429]) assert.equal(mayHaveBeenReceived(status), false, String(status));
});
