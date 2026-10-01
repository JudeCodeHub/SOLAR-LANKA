import assert from "node:assert/strict";
import { test } from "node:test";

import { formatList, productName, serviceLabel } from "./format.ts";

test("formatList joins districts and handles none", () => {
  assert.equal(formatList(["Colombo", "Gampaha"]), "Colombo, Gampaha");
  assert.equal(formatList([]), "");
});

test("serviceLabel uses the catalogue and keeps unknown codes visible", () => {
  assert.equal(serviceLabel("battery_installation"), "Battery installation");
  assert.equal(serviceLabel("brand_new_service"), "brand_new_service");
});

test("productName combines brand and model", () => {
  assert.equal(productName({ brand: "Trina", model: "TSM-450" }), "Trina TSM-450");
});
