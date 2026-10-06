import assert from "node:assert/strict";
import { test } from "node:test";

import { chartSpecs, financialRows, rangeDisplay, roofNote, sizingRows, widen, type Preview } from "./results.ts";

const full: Preview = {
  scenario: "grid_net_metering_no_backup",
  config_id: "35c8c4b7-5adb-442b-af33-4e11e40a4637",
  config_version: 2,
  sizing: {
    panel_count: { minimum: 5, maximum: 6 },
    roof_panel_capacity: 12,
    capacity_kwp: { minimum: "2.5", maximum: "3" },
    installed_area_m2: { minimum: "12.5", maximum: "15" },
    annual_generation_kwh: { minimum: "3012.4", maximum: "4001.2" },
    average_monthly_generation_kwh: { minimum: "251.03", maximum: "333.43" },
  },
  financial: {
    installed_cost_lkr: { minimum: "250000", maximum: "360000" },
    baseline_monthly_bill_lkr: "5400.5",
    monthly_savings_lkr: { minimum: "2100.4", maximum: "3500.6" },
    annual_savings_lkr: { minimum: "25204.8", maximum: "42007.2" },
    simple_payback_years: { minimum: "5.95", maximum: "14.28" },
  },
  sources: {},
  disclaimer: "Planning estimate only.",
};
const sent = { shading_condition: "partial", daytime_consumption_percent: "40" };
const bare: Preview = {
  ...full,
  sizing: { ...full.sizing, annual_generation_kwh: null, average_monthly_generation_kwh: null },
  financial: {
    installed_cost_lkr: null,
    baseline_monthly_bill_lkr: null,
    monthly_savings_lkr: null,
    annual_savings_lkr: null,
    simple_payback_years: null,
  },
};

test("ranges round outwards so they never look narrower than the server's numbers", () => {
  assert.deepEqual(widen({ minimum: "251.03", maximum: "333.43" }, 0), [251, 334]);
  assert.deepEqual(widen({ minimum: "5.95", maximum: "14.28" }, 1), [5.9, 14.3]);
  assert.equal(rangeDisplay({ minimum: "250000", maximum: "360000" }, 0), "250,000 to 360,000");
});

test("an exact value is not rounded away and a one-value range reads as one value", () => {
  assert.equal(rangeDisplay({ minimum: "2.5", maximum: "2.5" }, 2), "2.5");
  assert.equal(rangeDisplay({ minimum: "300", maximum: "300" }, 0), "300");
  assert.deepEqual(widen({ minimum: "0.1", maximum: "0.2" }, 1), [0.1, 0.2]);
});

test("a complete answer produces a value and no reason on every row", () => {
  for (const r of [...sizingRows(full, sent), ...financialRows(full, sent)]) {
    assert.ok(r.value, r.id);
    assert.equal(r.why, null, r.id);
  }
});

test("money rows are qualified as indicative and sizing rows are not", () => {
  assert.ok(financialRows(full, sent).every((r) => r.indicative));
  assert.ok(sizingRows(full, sent).every((r) => !r.indicative));
});

test("a missing output stays a row with a reason, never zero", () => {
  const rows = [...sizingRows(bare, { shading_condition: null, daytime_consumption_percent: null }), ...financialRows(bare, { shading_condition: null, daytime_consumption_percent: null })];
  const byId = Object.fromEntries(rows.map((r) => [r.id, r])) as Record<string, (typeof rows)[number]>;
  for (const id of ["annual", "monthly", "cost", "baseline", "monthlySavings", "annualSavings", "payback"]) {
    assert.equal(byId[id]?.value, null, id);
    assert.ok(byId[id]?.why, id);
  }
  assert.match(byId.annual?.why ?? "", /shading/i);
  assert.match(byId.baseline?.why ?? "", /shading/i);
  assert.match(byId.cost?.why ?? "", /cost basis/i);
  assert.match(byId.payback?.why ?? "", /installed cost/i);
});

test("the reason for missing savings names the input the visitor can supply, in order", () => {
  const noDaytime = { ...full, financial: { ...bare.financial } };
  const rows = financialRows(noDaytime, { shading_condition: "partial", daytime_consumption_percent: null });
  assert.match(rows.find((r) => r.id === "monthlySavings")?.why ?? "", /daytime/i);
  const published = financialRows(noDaytime, { shading_condition: "partial", daytime_consumption_percent: "40" });
  assert.match(published.find((r) => r.id === "monthlySavings")?.why ?? "", /tariff/i);
});

test("payback missing with cost and savings present says savings are not positive", () => {
  const preview: Preview = { ...full, financial: { ...full.financial, simple_payback_years: null } };
  assert.match(financialRows(preview, sent).find((r) => r.id === "payback")?.why ?? "", /not positive/i);
});

test("a genuine zero is shown as 0, not as missing", () => {
  const zero: Preview = {
    ...full,
    sizing: {
      ...full.sizing,
      panel_count: { minimum: 0, maximum: 0 },
      capacity_kwp: { minimum: "0", maximum: "0" },
      installed_area_m2: { minimum: "0", maximum: "0" },
      annual_generation_kwh: { minimum: "0", maximum: "0" },
      average_monthly_generation_kwh: { minimum: "0", maximum: "0" },
    },
  };
  const panels = sizingRows(zero, sent).find((r) => r.id === "panels");
  assert.equal(panels?.value, "0");
  assert.equal(sizingRows(zero, sent).find((r) => r.id === "annual")?.value, "0");
});

test("charts exist only when every figure they need exists, and carry the same numbers", () => {
  assert.deepEqual(chartSpecs(bare, "300"), []);
  const energyOnly = chartSpecs({ ...full, financial: bare.financial }, "300");
  assert.deepEqual(energyOnly.map((c) => c.id), ["energy"]);
  const both = chartSpecs(full, "300");
  assert.deepEqual(both.map((c) => c.id), ["energy", "bill"]);
  const energy = both[0];
  assert.ok(energy);
  assert.deepEqual(energy.bars.map((b) => b.value), [300, 251, 334]);
  assert.deepEqual(energy.bars.map((b) => b.label), ["300", "251", "334"]);
});

test("the bill with solar is the baseline less the saving, larger saving giving the lower bill", () => {
  const bill = chartSpecs(full, "300").find((c) => c.id === "bill");
  assert.ok(bill);
  // baseline 5400.5 -> 5401; savings widen to [2100, 3501]
  assert.deepEqual(bill.bars.map((b) => b.value), [5401, 3301, 1900]);
  assert.match(bill.summary, /5,401/);
  assert.match(bill.summary, /1,900/);
});

test("the bill with solar is never negative", () => {
  const big: Preview = { ...full, financial: { ...full.financial, monthly_savings_lkr: { minimum: "9000", maximum: "9999" } } };
  const bill = chartSpecs(big, "300").find((c) => c.id === "bill");
  assert.ok(bill?.bars.every((b) => b.value >= 0));
});

test("the roof note distinguishes no room, all room used, and neither", () => {
  assert.equal(roofNote({ ...full, sizing: { ...full.sizing, roof_panel_capacity: 0 } }), "none");
  assert.equal(roofNote({ ...full, sizing: { ...full.sizing, roof_panel_capacity: 6 } }), "limited");
  assert.equal(roofNote(full), null);
});

test("each row with a figure carries its rounded range for the bar, and rows without a figure carry none", () => {
  const sizing = Object.fromEntries(sizingRows(full, sent).map((entry) => [entry.id, entry.range]));
  assert.deepEqual(sizing.capacity, { low: 2.5, high: 3 });
  assert.deepEqual(sizing.annual, { low: 3012, high: 4002 });
  assert.deepEqual(sizing.panels, { low: 5, high: 6 });
  const money = Object.fromEntries(financialRows(full, sent).map((entry) => [entry.id, entry.range]));
  assert.deepEqual(money.baseline, { low: 5400, high: 5401 });
  assert.deepEqual(money.payback, { low: 5.9, high: 14.3 });
  for (const entry of [...sizingRows(bare, sent), ...financialRows(bare, sent)].filter((candidate) => candidate.value === null)) assert.equal(entry.range, null, entry.id);
});

test("a range of one value reads as one value and its range has the same two ends", () => {
  const one: Preview = { ...full, sizing: { ...full.sizing, capacity_kwp: { minimum: "6", maximum: "6" } } };
  const capacity = sizingRows(one, sent).find((entry) => entry.id === "capacity");
  assert.equal(capacity?.value, "6");
  assert.deepEqual(capacity?.range, { low: 6, high: 6 });
  assert.equal(rangeDisplay({ minimum: "6.00", maximum: "6" }, 2), "6");
});
