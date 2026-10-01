import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCatalogueHref,
  formatDecimal,
  needsCanonicalRedirect,
  offsetFor,
  PAGE_SIZE,
  pageInfo,
  pageWindow,
  parseCatalogueParams,
} from "./params.ts";

test("an empty address gives an empty, valid state on page 1", () => {
  const state = parseCatalogueParams("panel", {});
  assert.deepEqual(state, { values: {}, apiQuery: {}, errors: {}, page: 1 });
});

test("valid panel filters map to the backend's parameter names", () => {
  const state = parseCatalogueParams("panel", {
    q: "  Trina  ",
    min_w: "400",
    max_w: "450.5",
    min_eff: "21",
    page: "3",
  });
  assert.deepEqual(state.apiQuery, {
    search: "Trina",
    min_wattage_w: "400",
    max_wattage_w: "450.5",
    min_efficiency_percent: "21",
  });
  assert.equal(state.values.q, "Trina");
  assert.deepEqual(state.errors, {});
  assert.equal(state.page, 3);
});

test("valid inverter filters map to the backend's parameter names", () => {
  const state = parseCatalogueParams("inverter", { type: "hybrid", min_kw: "3", max_kw: "10" });
  assert.deepEqual(state.apiQuery, { category: "hybrid", min_capacity_kw: "3", max_capacity_kw: "10" });
});

test("a filter that belongs to the other kind is ignored", () => {
  const state = parseCatalogueParams("inverter", { min_w: "400", type: "hybrid" });
  assert.deepEqual(state.apiQuery, { category: "hybrid" });
  assert.deepEqual(state.values, { type: "hybrid" });
});

test("invalid values are reported, kept for the form, and never sent to the backend", () => {
  const bad = ["abc", "-5", "1e3", "0", "0x10", "12,5", "1.2.3", "  ", "9".repeat(20), "1000001"];
  for (const value of bad) {
    const state = parseCatalogueParams("panel", { min_w: value });
    assert.deepEqual(state.apiQuery, {}, JSON.stringify(value));
    if (value.trim() !== "") {
      assert.ok(state.errors.min_w, `${JSON.stringify(value)} should be reported`);
      assert.equal(state.values.min_w, value.trim());
    }
  }
  assert.ok(parseCatalogueParams("panel", { min_eff: "101" }).errors.min_eff);
  assert.ok(parseCatalogueParams("inverter", { type: "nuclear" }).errors.type);
  assert.deepEqual(parseCatalogueParams("inverter", { type: "nuclear" }).apiQuery, {});
  assert.ok(parseCatalogueParams("panel", { q: "x".repeat(101) }).errors.q);
});

test("one bad filter does not discard the good ones", () => {
  const state = parseCatalogueParams("panel", { q: "trina", min_w: "oops", min_eff: "20" });
  assert.deepEqual(state.apiQuery, { search: "trina", min_efficiency_percent: "20" });
  assert.deepEqual(Object.keys(state.errors), ["min_w"]);
});

test("a minimum above the maximum is reported on the maximum", () => {
  const state = parseCatalogueParams("panel", { min_w: "500", max_w: "400" });
  assert.ok(state.errors.max_w);
  assert.equal(state.apiQuery.max_wattage_w, undefined);
  assert.equal(state.apiQuery.min_wattage_w, "500"); // the valid one is still applied
  assert.deepEqual(parseCatalogueParams("panel", { min_w: "400", max_w: "400" }).errors, {});
});

test("repeated parameters use the first value and markup is just text", () => {
  assert.equal(parseCatalogueParams("panel", { q: ["first", "second"] }).values.q, "first");
  const hostile = parseCatalogueParams("panel", { q: '<script>alert("x")</script>' });
  assert.equal(hostile.values.q, '<script>alert("x")</script>'); // escaped by the renderer
  assert.equal(hostile.apiQuery.search, '<script>alert("x")</script>');
});

test("page numbers fall back to 1 unless they are whole and in range", () => {
  for (const page of ["abc", "0", "-1", "2.5", "", "1e2", "99999", "100000", "840"]) {
    assert.equal(parseCatalogueParams("panel", { page }).page, 1, page);
  }
  assert.equal(parseCatalogueParams("panel", { page: "2" }).page, 2);
  assert.equal(parseCatalogueParams("panel", { page: "834" }).page, 834); // last offset the API allows
  assert.equal(offsetFor(1), 0);
  assert.equal(offsetFor(3), 2 * PAGE_SIZE);
});

test("addresses are canonical and survive a round trip", () => {
  const href = buildCatalogueHref("/panels", "panel", {
    values: { min_eff: "21", q: "trina solar", min_w: "400" },
    page: 2,
  });
  assert.equal(href, "/panels?q=trina+solar&min_w=400&min_eff=21&page=2"); // stable field order
  const [, query] = href.split("?");
  const raw = Object.fromEntries(new URLSearchParams(query));
  const again = parseCatalogueParams("panel", raw);
  assert.deepEqual(again.values, { q: "trina solar", min_w: "400", min_eff: "21" });
  assert.equal(again.page, 2);
  assert.equal(buildCatalogueHref("/panels", "panel", { values: {}, page: 1 }), "/panels");
  assert.equal(buildCatalogueHref("/inverters", "inverter", { values: { type: "hybrid" }, page: 1 }), "/inverters?type=hybrid");
});

test("special characters are encoded so an address cannot inject parameters", () => {
  const href = buildCatalogueHref("/panels", "panel", { values: { q: "a&page=9#x" }, page: 1 });
  assert.equal(href, "/panels?q=a%26page%3D9%23x");
});

test("pageInfo reports positions, bounds and neighbours", () => {
  assert.deepEqual(pageInfo(0, 1), { page: 1, pageCount: 1, from: 0, to: 0, hasPrevious: false, hasNext: false });
  assert.deepEqual(pageInfo(10, 1), { page: 1, pageCount: 1, from: 1, to: 10, hasPrevious: false, hasNext: false });
  assert.deepEqual(pageInfo(30, 2), { page: 2, pageCount: 3, from: 13, to: 24, hasPrevious: true, hasNext: true });
  assert.deepEqual(pageInfo(30, 3), { page: 3, pageCount: 3, from: 25, to: 30, hasPrevious: true, hasNext: false });
  assert.equal(pageInfo(30, 99).page, 3); // clamps
  assert.equal(pageInfo(12, 1).pageCount, 1);
  assert.equal(pageInfo(13, 1).pageCount, 2);
});

test("pageWindow shows the ends and the neighbourhood with gaps marked", () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(1, 3), [1, 2, 3]);
  assert.deepEqual(pageWindow(5, 10), [1, null, 4, 5, 6, null, 10]);
  assert.deepEqual(pageWindow(2, 10), [1, 2, 3, null, 10]);
  assert.deepEqual(pageWindow(10, 10), [1, null, 9, 10]);
});

test("decimals lose trailing zeros but unknown stays unknown", () => {
  assert.equal(formatDecimal("415.000"), "415");
  assert.equal(formatDecimal("21.40"), "21.4");
  assert.equal(formatDecimal("21.45"), "21.45");
  assert.equal(formatDecimal("400"), "400");
  assert.equal(formatDecimal("0.000"), "0");
  assert.equal(formatDecimal(null), null);
  assert.equal(formatDecimal(undefined), null);
  assert.equal(formatDecimal(""), null);
});

test("addresses with no-op parameters are redirected to the clean form, clean ones are not", () => {
  const redirects = (raw: Record<string, string | string[] | undefined>) => {
    const state = parseCatalogueParams("panel", raw);
    return needsCanonicalRedirect("panel", raw, state);
  };
  // What a submitted GET form leaves behind.
  assert.equal(redirects({ q: "Zenith", min_w: "400", max_w: "", min_eff: "" }), true);
  assert.equal(redirects({ q: "", min_w: "", max_w: "", min_eff: "" }), true);
  assert.equal(redirects({ page: "1" }), true);
  assert.equal(redirects({ page: "banana" }), true);
  assert.equal(redirects({ q: "a", page: "0003" }), true);
  assert.equal(redirects({ q: ["a", "b"] }), true);
  // Already canonical: no redirect, so there can be no loop.
  assert.equal(redirects({}), false);
  assert.equal(redirects({ q: "Zenith", min_w: "400" }), false);
  assert.equal(redirects({ q: "Zenith", page: "2" }), false);
  assert.equal(redirects({ min_w: "abc" }), false); // invalid values stay so they can be explained
  assert.equal(redirects({ q: "  padded  " }), false); // only whitespace differs
  assert.equal(redirects({ utm_source: "newsletter" }), false); // unrelated parameters are left alone
  // The clean address itself never asks for another redirect.
  const state = parseCatalogueParams("panel", { q: "Zenith", min_w: "400", max_w: "" });
  const [, query = ""] = buildCatalogueHref("/panels", "panel", state).split("?");
  assert.equal(needsCanonicalRedirect("panel", Object.fromEntries(new URLSearchParams(query)), parseCatalogueParams("panel", Object.fromEntries(new URLSearchParams(query)))), false);
});

test("the page parser accepts whole numbers in range and falls back to 1", async () => {
  const { parsePageParam } = await import("./params.ts");
  assert.equal(parsePageParam(undefined), 1);
  assert.equal(parsePageParam("3"), 3);
  assert.equal(parsePageParam(["4", "9"]), 4);
  for (const bad of ["", "0", "-2", "2.5", "x", "99999"]) assert.equal(parsePageParam(bad), 1, bad);
});
