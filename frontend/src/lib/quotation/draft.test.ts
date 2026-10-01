import assert from "node:assert/strict";
import { test } from "node:test";

import { draftSchema, emptyDraft, formatMoney, isDirty, missingForSending, payloadKey, type TermsView, valuesFromTerms } from "./draft.ts";

const id = "0b2f8a4e-5c1d-4f3a-9b7e-1a2b3c4d5e6f";
const valid = {
  ...emptyDraft,
  lines: [
    { kind: "equipment" as const, product_id: id, description: " Panel A ", quantity: "2", unit_price: "100.05" },
    { kind: "charge" as const, product_id: "", description: "Installation", quantity: "1", unit_price: "50" },
  ],
  discount_kind: "percent" as const,
  discount_value: "10",
  tax_rate_percent: "18",
  capacity_kwp: "5.25",
  warranty_terms: " 10 years ",
  exclusions: "Roof repairs",
  validity_days: "30",
  notes: "",
};
const problems = (overrides: Record<string, unknown>) => {
  const r = draftSchema.safeParse({ ...valid, ...overrides });
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message]));
};

test("a valid form becomes exactly the request the backend expects", () => {
  const r = draftSchema.safeParse(valid);
  assert.ok(r.success);
  assert.deepEqual(r.data, {
    lines: [
      { kind: "equipment", product_id: id, description: "Panel A", quantity: "2", unit_price: "100.05" },
      { kind: "charge", product_id: null, description: "Installation", quantity: "1", unit_price: "50" },
    ],
    discount_kind: "percent",
    discount_value: "10",
    tax_rate_percent: "18",
    capacity_kwp: "5.25",
    warranty_terms: "10 years",
    exclusions: "Roof repairs",
    validity_days: 30,
    notes: null,
  });
});

test("the request carries no totals: the server calculates them", () => {
  const r = draftSchema.safeParse(valid);
  assert.ok(r.success);
  for (const key of ["subtotal", "discount", "tax", "total", "line_total"]) assert.ok(!(key in r.data), key);
  for (const entry of r.data.lines) assert.ok(!("line_total" in entry));
});

test("a charge never carries a product, and equipment must name one", () => {
  const charge = draftSchema.safeParse({ ...valid, lines: [{ kind: "charge", product_id: id, description: "x", quantity: "1", unit_price: "1" }] });
  assert.ok(charge.success);
  assert.equal(charge.data.lines[0]?.product_id, null);
  assert.ok(problems({ lines: [{ kind: "equipment", product_id: "", description: "x", quantity: "1", unit_price: "1" }] })["lines.0.product_id"]);
});

test("a quantity must be positive, a price may be zero, both plain decimals within their places", () => {
  const line = (quantity: string, unit_price: string) => ({ kind: "charge", product_id: "", description: "x", quantity, unit_price });
  assert.ok(problems({ lines: [line("0", "1")] })["lines.0.quantity"]);
  assert.ok(problems({ lines: [line("1.2345", "1")] })["lines.0.quantity"]);
  assert.ok(problems({ lines: [line("abc", "1")] })["lines.0.quantity"]);
  assert.deepEqual(problems({ lines: [line("1", "0")] }), {});
  assert.ok(problems({ lines: [line("1", "1.234")] })["lines.0.unit_price"]);
  assert.ok(problems({ lines: [line("1", "-5")] })["lines.0.unit_price"]);
});

test("a line needs a description, and at least one and at most 50 lines are allowed", () => {
  const blank = { kind: "charge", product_id: "", description: "  ", quantity: "1", unit_price: "1" };
  assert.ok(problems({ lines: [blank] })["lines.0.description"]);
  assert.ok(problems({ lines: [] }).lines);
  const many = Array.from({ length: 51 }, () => ({ kind: "charge", product_id: "", description: "x", quantity: "1", unit_price: "1" }));
  assert.ok(problems({ lines: many }).lines);
});

test("with no discount the value is zero, and a leftover value is refused rather than silently dropped", () => {
  const ok = draftSchema.parse({ ...valid, discount_kind: "none", discount_value: "" });
  assert.equal(ok.discount_value, "0.00");
  assert.ok(problems({ discount_kind: "none", discount_value: "5" }).discount_value);
});

test("a percentage cannot exceed 100, and the tax rate is 0 to 100 with a blank meaning zero", () => {
  assert.ok(problems({ discount_value: "101" }).discount_value);
  assert.ok(problems({ tax_rate_percent: "101" }).tax_rate_percent);
  assert.equal(draftSchema.parse({ ...valid, tax_rate_percent: "" }).tax_rate_percent, "0.00");
});

test("the terms are optional while drafting, and a blank is null rather than empty text", () => {
  const r = draftSchema.parse({ ...valid, capacity_kwp: "", warranty_terms: " ", exclusions: "", validity_days: "", notes: "  " });
  assert.deepEqual([r.capacity_kwp, r.warranty_terms, r.exclusions, r.validity_days, r.notes], [null, null, null, null, null]);
});

test("validity is a whole number of days from 1 to 90, and the text limits match the backend", () => {
  for (const bad of ["0", "91", "1.5", "abc", "-1"]) assert.ok(problems({ validity_days: bad }).validity_days, bad);
  assert.ok(problems({ warranty_terms: "x".repeat(2001) }).warranty_terms);
  assert.ok(problems({ notes: "x".repeat(4001) }).notes);
  assert.ok(problems({ capacity_kwp: "-1" }).capacity_kwp);
});

const saved: TermsView = {
  lines: [{ kind: "equipment", product_id: id, description: "Panel A", quantity: "2.000", unit_price: "100.05", line_total: "200.10" }],
  discount_kind: "percent", discount_value: "10.00", tax_rate_percent: "18.00", capacity_kwp: "5.250",
  warranty_terms: "10 years", exclusions: "Roof", validity_days: 30, notes: null,
  subtotal: "200.10", discount: "20.01", tax: "32.42", total: "212.51",
};

test("a saved draft reopens as the same values, tidied for reading", () => {
  const v = valuesFromTerms(saved);
  assert.equal(v.lines[0]?.quantity, "2");
  assert.equal(v.capacity_kwp, "5.25");
  assert.equal(v.validity_days, "30");
  assert.equal(v.discount_value, "10.00");
  assert.equal(v.notes, "");
});

test("a draft with no lines yet starts with one blank line", () => {
  assert.equal(valuesFromTerms({ ...saved, lines: [] }).lines.length, 1);
});

test("an unchanged form is not dirty, an edit or invalid input is", () => {
  const v = valuesFromTerms(saved);
  assert.equal(isDirty(saved, v), false);
  assert.equal(isDirty(saved, { ...v, notes: "new" }), true);
  assert.equal(isDirty(saved, { ...v, lines: [{ ...v.lines[0]!, quantity: "abc" }] }), true);
  assert.equal(payloadKey({ ...v, lines: [] }), null);
});

test("what is still needed before sending is listed from the saved draft", () => {
  assert.deepEqual(missingForSending(saved), []);
  assert.deepEqual(missingForSending({ ...saved, lines: [], capacity_kwp: null, validity_days: null, warranty_terms: null, exclusions: null }).sort(), ["capacity_kwp", "exclusions", "lines", "validity_days", "warranty_terms"]);
});

test("money is shown as the server returned it, never recalculated", () => {
  assert.equal(formatMoney("265.61"), "LKR 265.61");
  assert.equal(formatMoney("1234567.5"), "LKR 1,234,567.50");
  assert.equal(formatMoney(null), null);
});
