import assert from "node:assert/strict";
import { test } from "node:test";

import { type ComparisonOfferLike, compareRows, cellText, daysLeft, expiryText, inclusionsFromLines, isExpiringSoon, offerState, stateLabel, stateTone } from "./customer.ts";

const NOW = Date.parse("2026-10-10T00:00:00Z");
const sent = (valid_until: string | null) => ({ status: "sent", valid_until });

test("a sent offer is open until its valid-until time, then expired even if the stored status still says sent", () => {
  assert.equal(offerState(sent("2026-11-01T00:00:00Z"), NOW), "active");
  assert.equal(offerState(sent("2026-10-09T00:00:00Z"), NOW), "expired");
  assert.equal(offerState(sent("2026-10-10T00:00:00Z"), NOW), "expired");
});

test("accepted, declined, withdrawn and replaced offers each have their own state and wording", () => {
  assert.equal(offerState({ status: "accepted", valid_until: null }, NOW), "accepted");
  assert.equal(offerState({ status: "declined", valid_until: null }, NOW), "declined");
  assert.equal(offerState({ status: "withdrawn", valid_until: null }, NOW), "withdrawn");
  assert.equal(offerState({ status: "revised", valid_until: null }, NOW), "replaced");
  assert.equal(stateLabel("withdrawn"), "Withdrawn by the company");
  assert.equal(stateLabel("expired"), "Expired");
});

test("days left round up, and an offer with 3 days or fewer left is expiring soon", () => {
  assert.equal(daysLeft("2026-10-12T12:00:00Z", NOW), 3);
  assert.equal(isExpiringSoon(sent("2026-10-12T12:00:00Z"), NOW), true);
  assert.equal(isExpiringSoon(sent("2026-10-20T00:00:00Z"), NOW), false);
  assert.equal(isExpiringSoon(sent("2026-10-09T00:00:00Z"), NOW), false);
});

test("expiry is always put in words: when it ends and how long is left, or when it ended", () => {
  assert.equal(expiryText(sent("2026-11-09T00:00:00Z"), NOW), "Valid until 9 November 2026 (30 days left)");
  assert.match(expiryText(sent("2026-10-10T20:00:00Z"), NOW), /ending within a day/);
  assert.match(expiryText(sent("2026-10-01T00:00:00Z"), NOW), /Expired on 1 October 2026\. It can no longer be accepted/);
  assert.match(expiryText({ status: "declined", valid_until: "2026-11-01T00:00:00Z" }, NOW), /Was valid until/);
  assert.equal(expiryText(sent(null), NOW), "No end date given");
});

test("only equipment lines show panels and inverters as included, everything else is not specified, never excluded", () => {
  const i = inclusionsFromLines([{ kind: "equipment", product_snapshot: { kind: "panel" } }, { kind: "charge" }]);
  assert.equal(i.panel_equipment, "included");
  assert.equal(i.inverter_equipment, "not_specified");
  for (const key of ["installation_labour", "permits", "grid_connection", "monitoring", "maintenance"] as const) assert.equal(i[key], "not_specified", key);
  assert.ok(!Object.values(i).includes("excluded"));
});

const offer = (id: string, over: Partial<ComparisonOfferLike> = {}): ComparisonOfferLike => ({
  quotation_id: id, company_id: "c" + id, sent_at: "2026-10-01T00:00:00Z", valid_until: "2026-11-01T00:00:00Z",
  total_lkr: "265.61", capacity_kwp: "5.250", warranty_terms: "10 years", exclusions: "Roof repairs",
  equipment: [{ kind: "panel", brand: "Quote", model: "Panel One", description: "Panel A", quantity: "2.000" }],
  inclusions: { panel_equipment: "included", inverter_equipment: "not_specified", installation_labour: "not_specified", permits: "not_specified", grid_connection: "not_specified", monitoring: "not_specified", maintenance: "not_specified" },
  missing_fields: [], ...over,
});
const get = (rows: ReturnType<typeof compareRows>, id: string) => rows.find((r) => r.id === id)!;

test("no offers gives no rows", () => assert.deepEqual(compareRows([], NOW), []));

test("identical values are not marked as differing", () => {
  const rows = compareRows([offer("1"), offer("2")], NOW);
  assert.equal(get(rows, "total").differs, false);
  assert.equal(get(rows, "warranty").differs, false);
});

test("different totals, warranties and capacities are marked as differing", () => {
  const rows = compareRows([offer("1"), offer("2", { total_lkr: "300.00", warranty_terms: "5 years", capacity_kwp: "6.000" })], NOW);
  for (const id of ["total", "warranty", "capacity"]) assert.equal(get(rows, id).differs, true, id);
  assert.equal(get(rows, "sent").differs, false);
});

test("a missing value reads Not specified, and one offer saying while another does not is a difference", () => {
  const rows = compareRows([offer("1"), offer("2", { warranty_terms: null, capacity_kwp: null })], NOW);
  const warranty = get(rows, "warranty");
  assert.equal(cellText(warranty.cells[1]!), "Not specified");
  assert.equal(warranty.differs, true);
  assert.equal(warranty.someUnspecified, true);
  assert.equal(get(rows, "capacity").someUnspecified, true);
});

test("inclusions that no offer states are marked Not specified in every column, not as excluded", () => {
  const rows = compareRows([offer("1"), offer("2")], NOW);
  const permits = get(rows, "permits");
  assert.deepEqual(permits.cells.map(cellText), ["Not specified", "Not specified"]);
  assert.equal(permits.someUnspecified, true);
  assert.equal(permits.differs, false);
  assert.ok(!rows.some((r) => r.cells.some((c) => c.kind === "excluded")));
});

test("an inclusion one offer has and another lacks differs, with included and not specified shown", () => {
  const a = offer("1");
  const b = offer("2", { equipment: [], inclusions: { ...a.inclusions, panel_equipment: "not_specified" } });
  const rows = compareRows([a, b], NOW);
  const panels = get(rows, "panel_equipment");
  assert.deepEqual(panels.cells.map(cellText), ["Included", "Not specified"]);
  assert.equal(panels.differs, true);
  assert.equal(cellText(get(rows, "panels").cells[1]!), "Not specified");
});

test("equipment shows quantity and name, and quantities are tidied", () => {
  assert.equal(cellText(get(compareRows([offer("1")], NOW), "panels").cells[0]!), "2 × Quote Panel One");
});

test("each offer's expiry is shown in its own words and the missing-information row lists what is absent", () => {
  const rows = compareRows([offer("1"), offer("2", { valid_until: "2026-10-11T00:00:00Z", missing_fields: ["warranty_terms", "total_lkr"] })], NOW);
  assert.match(cellText(get(rows, "valid_until").cells[1]!), /ending within a day/);
  assert.equal(get(rows, "valid_until").differs, true);
  assert.equal(cellText(get(rows, "missing").cells[0]!), "Nothing missing");
  assert.equal(cellText(get(rows, "missing").cells[1]!), "warranty terms, total");
});

test("each offer state has a colour family, and the words stay different for every state", () => {
  assert.equal(stateTone("active"), "success");
  assert.equal(stateTone("accepted"), "success");
  assert.equal(stateTone("expired"), "warning");
  assert.equal(stateTone("draft"), "info");
  for (const state of ["declined", "withdrawn", "replaced"] as const) assert.equal(stateTone(state), "neutral");
  const words = (["active", "expired", "accepted", "declined", "withdrawn", "replaced", "draft"] as const).map(stateLabel);
  assert.equal(new Set(words).size, words.length);
});
