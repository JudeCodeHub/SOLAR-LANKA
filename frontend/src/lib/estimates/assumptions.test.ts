import assert from "node:assert/strict";
import { test } from "node:test";

import { settingRows } from "./assumptions.ts";

test("plain values and ranges become labelled rows with nothing rewritten", () => {
  const rows = settingRows({
    panel_wattage_w: "500",
    annual_yield_kwh_per_kwp: { low: "1400", high: "1600" },
    fixed_installation_cost_lkr: { low: "0", high: "0" },
  });
  assert.deepEqual(rows, [
    { label: "Panel rating (W)", value: "500" },
    { label: "Yearly yield (kWh per kWp)", value: "1400 to 1600" },
    { label: "Fixed installation cost (LKR)", value: "0" },
  ]);
});

test("nested shading factors are labelled by condition", () => {
  const rows = settingRows({ shading_factors: { partial: { low: "0.75", high: "0.85" } } });
  assert.deepEqual(rows, [{ label: "Shading factor, partial shading", value: "0.75 to 0.85" }]);
});

test("tariff bands and blocks are numbered and an open upper limit is said in words", () => {
  const rows = settingRows({
    domestic_tariff: {
      regimes: [
        {
          from_kwh: "60",
          through_kwh: null,
          blocks: [{ through_kwh: null, rate_lkr_per_kwh: "20" }],
          fixed_charge_lkr: "100",
        },
      ],
      tax_percent: "0",
    },
  });
  assert.deepEqual(rows, [
    { label: "Electricity tariff, Band 1, from (kWh)", value: "60" },
    { label: "Electricity tariff, Band 1, up to (kWh)", value: "No upper limit" },
    { label: "Electricity tariff, Band 1, Block 1, up to (kWh)", value: "No upper limit" },
    { label: "Electricity tariff, Band 1, Block 1, rate (LKR per kWh)", value: "20" },
    { label: "Electricity tariff, Band 1, fixed charge (LKR)", value: "100" },
    { label: "Electricity tariff, Tax (%)", value: "0" },
  ]);
});

test("an unknown key is still shown, humanised, and nothing is dropped", () => {
  assert.deepEqual(settingRows({ some_new_factor: "3" }), [{ label: "Some new factor", value: "3" }]);
  assert.deepEqual(settingRows({}), []);
});
