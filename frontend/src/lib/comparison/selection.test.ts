import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canCompare,
  compareHref,
  MAX_COMPARE,
  parseCompareIds,
  sanitizeSelection,
  toggleSelection,
} from "./selection.ts";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [A, B, C, D] = [id(1), id(2), id(3), id(4)];

test("toggling adds, then removes, the same product", () => {
  const added = toggleSelection([], A);
  assert.deepEqual(added, { ids: [A], outcome: "added" });
  assert.deepEqual(toggleSelection(added.ids, A), { ids: [], outcome: "removed" });
});

test("the limit is three and a fourth product is refused without changing anything", () => {
  let ids: string[] = [];
  for (const product of [A, B, C]) ids = toggleSelection(ids, product).ids;
  assert.deepEqual(ids, [A, B, C]);
  const refused = toggleSelection(ids, D);
  assert.equal(refused.outcome, "full");
  assert.deepEqual(refused.ids, [A, B, C]);
  assert.equal(refused.ids.length, MAX_COMPARE);
  // Making room lets a new product in again.
  const room = toggleSelection(refused.ids, B).ids;
  assert.deepEqual(toggleSelection(room, D), { ids: [A, C, D], outcome: "added" });
});

test("a product can never appear twice, however often it is toggled", () => {
  let ids: string[] = [];
  for (let i = 0; i < 20; i += 1) {
    ids = toggleSelection(ids, A).ids;
    assert.ok(ids.length <= 1);
    assert.equal(new Set(ids).size, ids.length);
  }
});

test("toggling does not mutate the list it was given", () => {
  const original = [A, B];
  toggleSelection(original, C);
  toggleSelection(original, A);
  assert.deepEqual(original, [A, B]);
});

test("a stored selection is checked before it is trusted", () => {
  assert.deepEqual(sanitizeSelection({ panel: [A, B], inverter: [C] }), { panel: [A, B], inverter: [C] });
  // Duplicates, malformed ids, wrong types and overflow are all dropped.
  assert.deepEqual(sanitizeSelection({ panel: [A, A, "nope", 5, null, B, C, D], inverter: "x" }), {
    panel: [A, B, C],
    inverter: [],
  });
  for (const junk of [null, undefined, 7, "text", [], { panel: "A" }, { inverter: { 0: A } }]) {
    assert.deepEqual(sanitizeSelection(junk), { panel: [], inverter: [] }, JSON.stringify(junk));
  }
});

test("a stored selection holds ids only, never product data", () => {
  const hostile = sanitizeSelection({ panel: [A], name: "Trina", panel_names: ["x"], inverter: [] });
  assert.deepEqual(Object.keys(hostile).sort(), ["inverter", "panel"]);
  assert.ok(Object.values(hostile).flat().every((entry) => /^[0-9a-f-]{36}$/.test(entry)));
});

test("a comparison needs two or three products", () => {
  assert.equal(canCompare([]), false);
  assert.equal(canCompare([A]), false);
  assert.equal(canCompare([A, B]), true);
  assert.equal(canCompare([A, B, C]), true);
  assert.equal(canCompare([A, B, C, D]), false);
});

test("comparison links carry the ids and read back the same", () => {
  assert.equal(compareHref("panel", [A, B]), `/panels/compare?ids=${A},${B}`);
  assert.equal(compareHref("inverter", [A, B, C]), `/inverters/compare?ids=${A},${B},${C}`);
  assert.equal(compareHref("panel", []), "/panels/compare");
  const [, query] = compareHref("panel", [A, B, C]).split("?");
  assert.deepEqual(parseCompareIds(new URLSearchParams(query).get("ids") ?? undefined), {
    ids: [A, B, C],
    ignored: 0,
  });
});

test("a comparison address keeps valid distinct ids, at most three, and counts the rest", () => {
  assert.deepEqual(parseCompareIds(undefined), { ids: [], ignored: 0 });
  assert.deepEqual(parseCompareIds(""), { ids: [], ignored: 0 });
  assert.deepEqual(parseCompareIds(`${A},${B}`), { ids: [A, B], ignored: 0 });
  assert.deepEqual(parseCompareIds(`${A},${A},${B}`), { ids: [A, B], ignored: 1 });
  assert.deepEqual(parseCompareIds(`${A},nope,${B},../etc,${C},${D}`), { ids: [A, B, C], ignored: 3 });
  assert.deepEqual(parseCompareIds([`${A}`, `${B},${C}`]), { ids: [A, B, C], ignored: 0 });
  assert.deepEqual(parseCompareIds(` ${A.toUpperCase()} , ${B} `), { ids: [A, B], ignored: 0 });
});
