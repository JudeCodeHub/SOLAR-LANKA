import assert from "node:assert/strict";
import { test } from "node:test";

import { estimatorDefaults, estimatorSchema } from "./schema.ts";
import { DEFAULT_SCENARIO, unsupportedParts } from "./scenario.ts";

const valid = {
  ...estimatorDefaults,
  monthly_consumption_kwh: "320",
  district: "Colombo",
  usable_roof_area_m2: "40",
};

test("the defaults are the one supported scenario", () => {
  assert.deepEqual(unsupportedParts({ ...DEFAULT_SCENARIO }), []);
});

test("net metering, net accounting and net plus are all supported", () => {
  for (const connection_scheme of ["net_metering", "net_accounting", "net_plus"]) {
    assert.deepEqual(unsupportedParts({ ...DEFAULT_SCENARIO, connection_scheme }), []);
  }
});

test("every other scheme, system type and backup choice is reported", () => {
  assert.deepEqual(unsupportedParts({ ...DEFAULT_SCENARIO, connection_scheme: "net_plus_plus" }), ["scheme"]);
  assert.deepEqual(unsupportedParts({ ...DEFAULT_SCENARIO, system_type: "hybrid" }), ["systemType"]);
  assert.deepEqual(unsupportedParts({ ...DEFAULT_SCENARIO, backup: "yes" }), ["backup"]);
  assert.deepEqual(
    unsupportedParts({ connection_scheme: "net_plus_plus", system_type: "off_grid", backup: "yes" }),
    ["scheme", "systemType", "backup"],
  );
});

test("a valid form becomes the exact request: numbers as typed, blanks as unknown, not zero", () => {
  const result = estimatorSchema.safeParse({ ...valid, monthly_consumption_kwh: " 320.5 " });
  assert.ok(result.success);
  assert.deepEqual(result.data, {
    monthly_consumption_kwh: "320.5",
    district: "Colombo",
    usable_roof_area_m2: "40",
    shading_condition: null,
    daytime_consumption_percent: null,
    monthly_bill_lkr: null,
    connection_scheme: "net_metering",
    system_type: "on_grid",
    backup_required: false,
  });
});

test("a typed zero stays zero while a blank optional is unknown", () => {
  const result = estimatorSchema.safeParse({
    ...valid,
    usable_roof_area_m2: "0",
    daytime_consumption_percent: "0",
    monthly_bill_lkr: "",
  });
  assert.ok(result.success);
  assert.equal(result.data.usable_roof_area_m2, "0");
  assert.equal(result.data.daytime_consumption_percent, "0");
  assert.equal(result.data.monthly_bill_lkr, null);
});

function problems(overrides: Record<string, string>) {
  const result = estimatorSchema.safeParse({ ...valid, ...overrides });
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
}

test("required fields are required", () => {
  const found = problems({ monthly_consumption_kwh: "", district: "", usable_roof_area_m2: "  " });
  assert.deepEqual(Object.keys(found).sort(), ["district", "monthly_consumption_kwh", "usable_roof_area_m2"]);
});

test("only plain non-negative decimals are accepted", () => {
  for (const bad of ["-5", "1e3", "0x10", "1,000", "abc", ".5", "5.", "+4", "NaN"]) {
    assert.ok(problems({ monthly_consumption_kwh: bad }).monthly_consumption_kwh, bad);
  }
});

test("limits match the backend: places, percentage and a sane maximum", () => {
  assert.ok(problems({ monthly_consumption_kwh: "1.2345" }).monthly_consumption_kwh);
  assert.deepEqual(problems({ monthly_consumption_kwh: "1.234" }), {});
  assert.ok(problems({ usable_roof_area_m2: "10.123" }).usable_roof_area_m2);
  assert.ok(problems({ daytime_consumption_percent: "100.01" }).daytime_consumption_percent);
  assert.deepEqual(problems({ daytime_consumption_percent: "100" }), {});
  assert.ok(problems({ monthly_bill_lkr: "abc" }).monthly_bill_lkr);
  assert.ok(problems({ monthly_consumption_kwh: "1000001" }).monthly_consumption_kwh);
});

test("a district outside the backend's list is refused", () => {
  assert.ok(problems({ district: "Atlantis" }).district);
});

test("each supported scheme is sent as chosen", () => {
  for (const scheme of ["net_metering", "net_accounting", "net_plus"]) {
    const result = estimatorSchema.safeParse({ ...valid, connection_scheme: scheme });
    assert.ok(result.success);
    assert.equal(result.data.connection_scheme, scheme);
  }
});

test("unsupported scenarios are refused on the field that caused them, never sent", () => {
  assert.ok(problems({ connection_scheme: "net_plus_plus" }).connection_scheme);
  assert.ok(problems({ system_type: "off_grid" }).system_type);
  assert.ok(problems({ backup: "yes" }).backup);
  assert.deepEqual(Object.keys(problems({ connection_scheme: "net_plus_plus", backup: "yes" })).sort(), ["backup", "connection_scheme"]);
});

test("choices outside the allowed lists are refused", () => {
  assert.ok(problems({ connection_scheme: "gold" }).connection_scheme);
  assert.ok(problems({ shading_condition: "lots" }).shading_condition);
});

import { rangeText } from "./format.ts";

test("a range of one value reads as that value, a real range as low to high", () => {
  assert.equal(rangeText("2.5", "2.50"), "2.5");
  assert.equal(rangeText("3.000", "4.5"), "3 to 4.5");
  assert.equal(rangeText(5, 5), "5");
});
