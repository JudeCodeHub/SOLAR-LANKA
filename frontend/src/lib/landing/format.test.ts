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

test("articlePhoto picks the photo that suits the guide, and otherwise rotates through three", async () => {
  const { articlePhoto } = await import("./format.ts");
  assert.equal(articlePhoto("net-metering-and-other-schemes", 0), "learnGrid");
  assert.equal(articlePhoto("reading-a-datasheet", 1), "learnDatasheet");
  assert.equal(articlePhoto("understanding-your-electricity-bill", 2), "learnBill");
  assert.equal(articlePhoto("cleaning-your-panels-safely", 0), "learnCleaning");
  assert.equal(articlePhoto("when-to-call-a-technician", 0), "learnTechnician");
  assert.equal(articlePhoto("something-else", 0), "learnHow");
  assert.equal(articlePhoto("something-else", 1), "learnPanels");
  assert.equal(articlePhoto("something-else", 4), "learnPanels");
});
