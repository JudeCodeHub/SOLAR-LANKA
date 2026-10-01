import assert from "node:assert/strict";
import { test } from "node:test";

import type { components } from "../api/schema.d.ts";

import {
  completenessSummary,
  countUnspecified,
  documentGroups,
  documentLabel,
  formatOfferPrice,
  type ProductDetail,
  productImages,
  safeExternalUrl,
  sourceInfo,
  specificationGroups,
} from "./detail.ts";

const base = {
  id: "11111111-1111-4111-8111-111111111111",
  brand: "Test",
  model: "T-1",
  media: [],
  image_urls: null,
  datasheet_urls: null,
  source_url: null,
  verified_at: null,
  created_at: "2026-01-01T00:00:00Z",
};

type PanelSpecs = components["schemas"]["PanelSpecifications"];
type InverterSpecs = components["schemas"]["InverterSpecifications"];

const emptyPanel: PanelSpecs = {
  wattage_w: null,
  efficiency_percent: null,
  cell_type: null,
  voltage_at_max_power_v: null,
  open_circuit_voltage_v: null,
  current_at_max_power_a: null,
  short_circuit_current_a: null,
  product_warranty_years: null,
  performance_warranty_years: null,
  warranty_details: null,
  country_of_manufacture: null,
};
const emptyInverter: InverterSpecs = {
  category: null,
  capacity_kw: null,
  mppt_count: null,
  connectivity: null,
  warranty_years: null,
  warranty_details: null,
  compatibility_notes: null,
  compatibility_source_url: null,
  manual_urls: null,
  manufacturer_document_urls: null,
  error_code_reference_urls: null,
};

const panel = (specs: Partial<PanelSpecs>, extra = {}): ProductDetail =>
  ({ ...base, kind: "panel", ...extra, specifications: { ...emptyPanel, ...specs } }) as ProductDetail;
const inverter = (specs: Partial<InverterSpecs>, extra = {}): ProductDetail =>
  ({ ...base, kind: "inverter", ...extra, specifications: { ...emptyInverter, ...specs } }) as ProductDetail;

const valueOf = (product: ProductDetail, key: string) =>
  specificationGroups(product)
    .flatMap((g) => g.rows)
    .find((row) => row.key === key)?.value;

test("panel values carry explicit units and trim needless zeros", () => {
  const product = panel({
    wattage_w: "415.000",
    efficiency_percent: "21.40",
    voltage_at_max_power_v: "31.5",
    open_circuit_voltage_v: "37.8",
    current_at_max_power_a: "13.18",
    short_circuit_current_a: "13.9",
    cell_type: "  Monocrystalline  ",
    country_of_manufacture: "China",
  });
  assert.equal(valueOf(product, "wattage_w"), "415 W");
  assert.equal(valueOf(product, "efficiency_percent"), "21.4 %");
  assert.equal(valueOf(product, "voltage_at_max_power_v"), "31.5 V");
  assert.equal(valueOf(product, "current_at_max_power_a"), "13.18 A");
  assert.equal(valueOf(product, "cell_type"), "Monocrystalline");
  assert.equal(valueOf(product, "country_of_manufacture"), "China");
});

test("unknown values are null, never zero, empty or a guess", () => {
  const groups = specificationGroups(panel({}));
  for (const row of groups.flatMap((g) => g.rows)) {
    assert.equal(row.value, null, row.key);
  }
  // Blank text counts as unknown too.
  assert.equal(valueOf(panel({ cell_type: "   ", warranty_details: "" }), "cell_type"), null);
  assert.equal(valueOf(panel({ warranty_details: "" }), "warranty_details"), null);
});

test("a real zero stays a zero and is not mistaken for unknown", () => {
  assert.equal(valueOf(panel({ product_warranty_years: "0.000" }), "product_warranty_years"), "0 years");
  assert.equal(valueOf(panel({ product_warranty_years: null }), "product_warranty_years"), null);
  assert.equal(valueOf(inverter({ mppt_count: 0 }), "mppt_count"), "0");
  assert.equal(valueOf(inverter({ mppt_count: null }), "mppt_count"), null);
  assert.equal(valueOf(panel({ wattage_w: "0" }), "wattage_w"), "0 W");
});

test("years use the singular only for exactly one", () => {
  assert.equal(valueOf(panel({ product_warranty_years: "1.000" }), "product_warranty_years"), "1 year");
  assert.equal(valueOf(panel({ product_warranty_years: "12.000" }), "product_warranty_years"), "12 years");
  assert.equal(valueOf(panel({ performance_warranty_years: "12.5" }), "performance_warranty_years"), "12.5 years");
});

test("inverter values: type, capacity, inputs, lists", () => {
  const product = inverter({
    category: "hybrid",
    capacity_kw: "10.000",
    mppt_count: 2,
    connectivity: ["Wi-Fi", " ", "RS485"],
    warranty_years: "5.000",
    compatibility_notes: "Works with the manufacturer's battery range.",
  });
  assert.equal(valueOf(product, "category"), "Hybrid");
  assert.equal(valueOf(product, "capacity_kw"), "10 kW");
  assert.equal(valueOf(product, "mppt_count"), "2");
  assert.equal(valueOf(product, "connectivity"), "Wi-Fi, RS485");
  assert.equal(valueOf(product, "warranty_years"), "5 years");
  assert.equal(valueOf(inverter({ connectivity: [] }), "connectivity"), null);
  assert.equal(valueOf(inverter({ connectivity: null }), "connectivity"), null);
  assert.equal(valueOf(inverter({}), "category"), null);
});

test("the compatibility group always carries the never-infer warning", () => {
  const group = specificationGroups(inverter({})).find((g) => g.id === "compatibility");
  assert.match(group?.note ?? "", /never inferred from capacity/);
});

test("completeness counts what is unspecified and says so in words", () => {
  const empty = specificationGroups(panel({}));
  assert.deepEqual(countUnspecified(empty), { unspecified: 11, total: 11 });
  assert.equal(completenessSummary(empty), "11 of 11 specifications are not specified.");
  const full = specificationGroups(
    panel({
      wattage_w: "400", efficiency_percent: "20", cell_type: "x", voltage_at_max_power_v: "1",
      open_circuit_voltage_v: "1", current_at_max_power_a: "1", short_circuit_current_a: "1",
      product_warranty_years: "1", performance_warranty_years: "1", warranty_details: "x",
      country_of_manufacture: "x",
    }),
  );
  assert.equal(completenessSummary(full), "Every listed specification has a value.");
  assert.equal(countUnspecified(specificationGroups(panel({ wattage_w: "400" }))).unspecified, 10);
});

test("only plain http(s) links without credentials are ever opened", () => {
  assert.equal(safeExternalUrl("https://example.com/a.pdf"), "https://example.com/a.pdf");
  assert.equal(safeExternalUrl("http://example.com/"), "http://example.com/");
  for (const unsafe of [
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "ftp://example.com/file",
    "file:///etc/passwd",
    "https://user:pass@example.com/",
    "not a url",
    "//example.com/x",
    "",
    null,
    undefined,
  ]) {
    assert.equal(safeExternalUrl(unsafe), null, String(unsafe));
  }
});

test("document names come from the file name, else the site", () => {
  assert.equal(documentLabel("https://example.com/docs/Trina%20TSM-415.pdf"), "Trina TSM-415.pdf");
  assert.equal(documentLabel("https://example.com/"), "example.com");
  assert.equal(documentLabel("https://example.com/a/b/"), "b");
});

test("documents are grouped, deduplicated and unsafe links dropped", () => {
  const product = panel({}, {
    datasheet_urls: ["https://example.com/a.pdf", "https://example.com/a.pdf", "javascript:alert(1)"],
    media: [
      { id: "m1", category: "product_datasheet", url: "https://ik.example/b.pdf" },
      { id: "m2", category: "product_image", url: "https://ik.example/p.jpg" },
    ],
  });
  const groups = documentGroups(product);
  assert.deepEqual(groups.map((g) => g.id), ["datasheets"]);
  assert.deepEqual(groups[0]?.links.map((l) => l.href), ["https://example.com/a.pdf", "https://ik.example/b.pdf"]);
  assert.deepEqual(documentGroups(panel({})), []); // nothing attached: no empty headings
});

test("inverter documents include manuals, manufacturer files, error codes and the compatibility source", () => {
  const groups = documentGroups(
    inverter({
      manual_urls: ["https://example.com/manual.pdf"],
      manufacturer_document_urls: ["https://example.com/spec.pdf"],
      error_code_reference_urls: ["https://example.com/errors.pdf"],
      compatibility_source_url: "https://example.com/compat",
    }),
  );
  assert.deepEqual(groups.map((g) => g.id), ["manuals", "manufacturer", "error-codes", "compatibility"]);
});

test("only attached https product images are shown", () => {
  const product = panel({}, {
    media: [
      { id: "a", category: "product_image", url: "https://ik.example/a.jpg" },
      { id: "b", category: "product_image", url: "http://insecure.example/b.jpg" },
      { id: "c", category: "product_image", url: "javascript:alert(1)" },
      { id: "d", category: "product_datasheet", url: "https://ik.example/d.pdf" },
    ],
    image_urls: ["https://anywhere.example/raw.jpg"], // unverified admin text is not displayed
  });
  assert.deepEqual(productImages(product).map((i) => i.href), ["https://ik.example/a.jpg"]);
});

test("source info keeps what is recorded and nothing else", () => {
  assert.deepEqual(sourceInfo(panel({})), { url: null, verifiedAt: null });
  assert.deepEqual(
    sourceInfo(panel({}, { source_url: "https://example.com/ds", verified_at: "2026-09-01T00:00:00Z" })),
    { url: "https://example.com/ds", verifiedAt: "2026-09-01T00:00:00Z" },
  );
  assert.equal(sourceInfo(panel({}, { source_url: "javascript:alert(1)" })).url, null);
});

test("offer prices keep the currency and treat no price differently from zero", () => {
  assert.equal(formatOfferPrice({ indicative_price: "450000.00", currency: "LKR" }), "LKR 450,000.00");
  assert.equal(formatOfferPrice({ indicative_price: "0.00", currency: "LKR" }), "LKR 0.00");
  assert.equal(formatOfferPrice({ indicative_price: "1999.5", currency: "USD" }), "USD 1,999.50");
  assert.equal(formatOfferPrice({ indicative_price: null, currency: null }), null);
  assert.equal(formatOfferPrice({ indicative_price: "oops", currency: "LKR" }), null);
});
