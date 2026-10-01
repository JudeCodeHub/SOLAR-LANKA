import assert from "node:assert/strict";
import { test } from "node:test";

import { backHref, detailHref, isProductId } from "./links.ts";

const ID = "5f269128-7973-4c85-a4df-f01b3ad725fa";

test("a product link remembers a filtered list and stays plain for the unfiltered one", () => {
  assert.equal(detailHref("panel", ID, "/panels"), `/panels/${ID}`);
  assert.equal(
    detailHref("panel", ID, "/panels?q=Zenith&min_w=400&page=2"),
    `/panels/${ID}?from=%2Fpanels%3Fq%3DZenith%26min_w%3D400%26page%3D2`,
  );
  assert.equal(detailHref("inverter", ID, "/inverters?type=hybrid"), `/inverters/${ID}?from=%2Finverters%3Ftype%3Dhybrid`);
});

test("Back returns to the remembered view of the same list", () => {
  assert.equal(backHref("panel", "/panels?q=Zenith&page=2"), "/panels?q=Zenith&page=2");
  assert.equal(backHref("panel", "/panels"), "/panels");
  assert.equal(backHref("inverter", "/inverters?type=hybrid"), "/inverters?type=hybrid");
});

test("Back never leaves the catalogue list, whatever the address says", () => {
  for (const hostile of [
    undefined,
    "",
    "https://evil.test/",
    "//evil.test/panels",
    "/account",
    "/inverters?type=hybrid", // the other list
    "/panelsX",
    "/panels/../account",
    "/panels?q=a#frag",
    "javascript:alert(1)",
    "/panels\\evil",
    "/panels?q=a\nSet-Cookie: x",
    "panels?q=a",
  ]) {
    assert.equal(backHref("panel", hostile), "/panels", String(hostile));
  }
  assert.equal(backHref("panel", ["/panels?q=a", "/account"]), "/panels?q=a"); // first value only
});

test("product ids must be well-formed UUIDs", () => {
  assert.equal(isProductId(ID), true);
  for (const bad of ["", "abc", "123", `${ID}x`, "../etc/passwd", "5f269128-7973-4c85-a4df-f01b3ad725f", "%00", "null"]) {
    assert.equal(isProductId(bad), false, bad);
  }
});
