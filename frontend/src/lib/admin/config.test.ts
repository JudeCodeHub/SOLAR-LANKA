import assert from "node:assert/strict";
import test from "node:test";

import { parseDraft, pretty, refusalFor, sameJson } from "./config.ts";

const source = { publisher: "P", title: "T", url: "https://example.org", unit: "kWh", reviewed_on: "2026-09-28", limitation: "Fictional" };
const sources = pretty({ yield: source, tariff: source, cost: source });

test("valid documents produce the request", () => {
  const result = parseDraft('{"yield_kwh_per_kwp_year": 1500}', sources);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal((result.body.assumptions as { yield_kwh_per_kwp_year: number }).yield_kwh_per_kwp_year, 1500);
});

test("text that is not JSON, or not an object, is named", () => {
  assert.ok(!parseDraft("{oops", sources).ok);
  const bad = parseDraft("[1]", sources);
  assert.ok(!bad.ok && bad.errors.assumptions);
});

test("empty assumptions are refused as the backend does", () => {
  const result = parseDraft("{}", sources);
  assert.ok(!result.ok && result.errors.assumptions);
});

test("each source must be complete with a web address and a real date", () => {
  const noCost = JSON.parse(sources); delete noCost.cost;
  let result = parseDraft('{"a":1}', JSON.stringify(noCost));
  assert.ok(!result.ok && /cost/.test(result.errors.sources ?? ""));
  const noUnit = JSON.parse(sources); noUnit.tariff.unit = "";
  result = parseDraft('{"a":1}', JSON.stringify(noUnit));
  assert.ok(!result.ok && /tariff.*unit/.test(result.errors.sources ?? ""));
  const badUrl = JSON.parse(sources); badUrl.yield.url = "ftp://x";
  assert.ok(!parseDraft('{"a":1}', JSON.stringify(badUrl)).ok);
  const badDate = JSON.parse(sources); badDate.cost.reviewed_on = "28/09/2026";
  assert.ok(!parseDraft('{"a":1}', JSON.stringify(badDate)).ok);
});

test("formatting and key order do not count as a change", () => {
  assert.equal(sameJson('{"b":1,"a":{"y":2,"x":1}}', { a: { x: 1, y: 2 }, b: 1 }), true);
  assert.equal(sameJson('{"a":2}', { a: 1 }), false);
});

test("a refused change is explained from the current version", () => {
  assert.match(refusalFor({ status: "published", is_archived: false }, "save"), /published/i);
  assert.match(refusalFor({ status: "draft", is_archived: true }, "publish"), /archived/i);
  assert.match(refusalFor({ status: "published", is_archived: false }, "archive"), /newer/i);
  assert.ok(refusalFor(undefined, "save"));
});

const exportSource = { ...source, effective_from: "2026-08-25" };
const withExport = pretty({ yield: source, tariff: source, cost: source, export: exportSource });
const rate = '{"a":1,"export_rate_lkr_per_kwh":{"low":"20","high":"23.11"}}';

test("net metering needs no export rate or source and the scenario is sent", () => {
  const result = parseDraft('{"a":1}', sources);
  assert.ok(result.ok && result.body.scenario === "grid_net_metering_no_backup");
});

test("export scenarios need a rate range, a source and its start date", () => {
  for (const scenario of ["grid_net_accounting_no_backup", "grid_net_plus_no_backup"] as const) {
    const good = parseDraft(rate, withExport, scenario);
    assert.ok(good.ok && good.body.scenario === scenario);
    assert.ok(!parseDraft('{"a":1}', withExport, scenario).ok);
    assert.ok(!parseDraft(rate, sources, scenario).ok);
    const undated = JSON.parse(withExport); delete undated.export.effective_from;
    const noDate = parseDraft(rate, JSON.stringify(undated), scenario);
    assert.ok(!noDate.ok && /effective_from/.test(noDate.errors.sources ?? ""));
    const backwards = parseDraft('{"a":1,"export_rate_lkr_per_kwh":{"low":"30","high":"20"}}', withExport, scenario);
    assert.ok(!backwards.ok && backwards.errors.assumptions);
  }
});
