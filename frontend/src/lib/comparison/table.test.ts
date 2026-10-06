import assert from "node:assert/strict";
import { test } from "node:test";

import type { components } from "../api/schema.d.ts";
import type { ProductDetail } from "../catalogue/detail.ts";
import { buildComparison, type CompareCell } from "./table.ts";

type PanelSpecs = components["schemas"]["PanelSpecifications"];
const emptyPanel: PanelSpecs = {
  wattage_w: null, efficiency_percent: null, cell_type: null, voltage_at_max_power_v: null,
  open_circuit_voltage_v: null, current_at_max_power_a: null, short_circuit_current_a: null,
  product_warranty_years: null, performance_warranty_years: null, warranty_details: null,
  country_of_manufacture: null,
};
const panel = (specs: Partial<PanelSpecs>, extra: Record<string, unknown> = {}): ProductDetail =>
  ({
    id: "11111111-1111-4111-8111-111111111111", kind: "panel", brand: "B", model: "M", media: [],
    image_urls: null, datasheet_urls: null, source_url: null, verified_at: null,
    created_at: "2026-01-01T00:00:00Z", ...extra, specifications: { ...emptyPanel, ...specs },
  }) as ProductDetail;

const cellsFor = (sections: ReturnType<typeof buildComparison>, key: string): CompareCell[] =>
  sections.flatMap((s) => s.rows).find((row) => row.key === key)?.cells ?? [];

test("values line up per product, with units, in the order the products were given", () => {
  const sections = buildComparison([
    panel({ wattage_w: "415.000", efficiency_percent: "21.40" }),
    panel({ wattage_w: "450", efficiency_percent: null }),
  ]);
  assert.deepEqual(cellsFor(sections, "wattage_w"), [
    { kind: "value", text: "415 W" },
    { kind: "value", text: "450 W" },
  ]);
  assert.deepEqual(cellsFor(sections, "efficiency_percent"), [
    { kind: "value", text: "21.4 %" },
    { kind: "unspecified" },
  ]);
});

test("every row has exactly one cell per column, whatever is missing", () => {
  const sections = buildComparison([panel({}), panel({ wattage_w: "400" }), null]);
  for (const row of sections.flatMap((s) => s.rows)) {
    assert.equal(row.cells.length, 3, row.key);
  }
});

test("an unknown value and an unavailable product are marked differently", () => {
  const sections = buildComparison([panel({ wattage_w: "415" }), null]);
  assert.deepEqual(cellsFor(sections, "wattage_w"), [{ kind: "value", text: "415 W" }, { kind: "unavailable" }]);
  assert.deepEqual(cellsFor(buildComparison([panel({}), panel({})]), "wattage_w"), [
    { kind: "unspecified" },
    { kind: "unspecified" },
  ]);
});

test("a real zero stays a value and is not turned into unspecified", () => {
  const sections = buildComparison([panel({ product_warranty_years: "0.000" }), panel({})]);
  assert.deepEqual(cellsFor(sections, "product_warranty_years"), [
    { kind: "value", text: "0 years" },
    { kind: "unspecified" },
  ]);
});

test("source rows show a safe link, the lack of one, and the verification date", () => {
  const sections = buildComparison([
    panel({}, { source_url: "https://example.com/ds", verified_at: "2026-09-15T00:00:00Z" }),
    panel({}, { source_url: "javascript:alert(1)" }),
    panel({}),
  ]);
  assert.deepEqual(cellsFor(sections, "source"), [
    { kind: "link", text: "Open source", href: "https://example.com/ds" },
    { kind: "value", text: "No source recorded" },
    { kind: "value", text: "No source recorded" },
  ]);
  assert.deepEqual(cellsFor(sections, "verified"), [
    { kind: "value", text: "15 September 2026" },
    { kind: "unspecified" },
    { kind: "unspecified" },
  ]);
});

test("nothing to compare when no product could be loaded", () => {
  assert.deepEqual(buildComparison([]), []);
  assert.deepEqual(buildComparison([null, null]), []);
});

test("rowRelation says whether a row is the same, differs, or has values not specified, ignoring products that could not be loaded", async () => {
  const { rowRelation } = await import("./table.ts");
  const value = (text: string) => ({ kind: "value" as const, text });
  assert.equal(rowRelation([value("415 W"), value("415 W")]), "same");
  assert.equal(rowRelation([value("415 W"), value("420 W"), value("415 W")]), "differs");
  assert.equal(rowRelation([value("415 W"), { kind: "unspecified" }]), "unspecified");
  assert.equal(rowRelation([{ kind: "unspecified" }, { kind: "unspecified" }]), "none");
  assert.equal(rowRelation([value("415 W"), { kind: "unavailable" }]), "same");
  assert.equal(rowRelation([value("1"), value("2"), { kind: "unavailable" }]), "differs");
});
