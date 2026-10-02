import assert from "node:assert/strict";
import test from "node:test";

import { INVERTER_FIELDS, nameChanges, PANEL_FIELDS, specChanges, toValues, validateNames, validateSpecs } from "./catalogue.ts";

const panel = { wattage_w: "415.00", efficiency_percent: "21.4", cell_type: null, warranty_details: "12 years" };

test("an unknown stored value starts as an empty field", () => {
  const values = toValues(panel, PANEL_FIELDS);
  assert.equal(values.cell_type, "");
  assert.equal(values.wattage_w, "415.00");
});

test("only changed fields are sent, and an emptied field is sent as null", () => {
  const original = toValues(panel, PANEL_FIELDS);
  assert.deepEqual(specChanges(PANEL_FIELDS, { ...original, wattage_w: "420", warranty_details: "" }, original), { wattage_w: "420", warranty_details: null });
  assert.deepEqual(specChanges(PANEL_FIELDS, original, original), {});
});

test("numbers follow the backend's ranges", () => {
  const original = toValues(panel, PANEL_FIELDS);
  const check = (key: string, value: string) => validateSpecs(PANEL_FIELDS, { ...original, [key]: value }, original)[key];
  assert.ok(check("wattage_w", "0"));
  assert.ok(check("wattage_w", "abc"));
  assert.ok(check("efficiency_percent", "101"));
  assert.equal(check("efficiency_percent", "100"), undefined);
  assert.equal(check("product_warranty_years", "0"), undefined);
  assert.ok(check("product_warranty_years", "-1"));
});

test("an unchanged invalid-looking stored value is not complained about", () => {
  const original = toValues({ wattage_w: "0" }, PANEL_FIELDS);
  assert.deepEqual(validateSpecs(PANEL_FIELDS, original, original), {});
});

test("inverter compatibility notes need a source", () => {
  const original = toValues({ capacity_kw: "5.0" }, INVERTER_FIELDS);
  const values = { ...original, compatibility_notes: "Works with X" };
  assert.ok(validateSpecs(INVERTER_FIELDS, values, original).compatibility_source_url);
  assert.deepEqual(validateSpecs(INVERTER_FIELDS, { ...values, compatibility_source_url: "https://example.org" }, original), {});
});

test("MPPT count is a whole number and is sent as one", () => {
  const original = toValues({ mppt_count: 2 }, INVERTER_FIELDS);
  assert.ok(validateSpecs(INVERTER_FIELDS, { ...original, mppt_count: "2.5" }, original).mppt_count);
  assert.deepEqual(specChanges(INVERTER_FIELDS, { ...original, mppt_count: "3" }, original), { mppt_count: 3 });
});

test("brand and model cannot be emptied and are sent only when changed", () => {
  const original = { brand: "Acme", model: "P1" };
  assert.ok(validateNames({ brand: " ", model: "P1" }, original).brand);
  assert.deepEqual(nameChanges({ brand: "Acme", model: " P2 " }, original), { model: "P2" });
});
