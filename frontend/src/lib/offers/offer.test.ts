import assert from "node:assert/strict";
import { test } from "node:test";

import { createBody, emptyOfferForm, hasChanges, offerChanges, offerSchema, specLine, valuesFromOffer } from "./offer.ts";

const ok = { ...emptyOfferForm };
const parse = (overrides: Record<string, unknown> = {}) => offerSchema.safeParse({ ...ok, ...overrides });
const problems = (overrides: Record<string, unknown>) => {
  const r = parse(overrides);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message]));
};

test("an empty form is a valid offer with no price, no currency and no claim", () => {
  const r = parse();
  assert.ok(r.success);
  assert.deepEqual(r.data, { indicative_price: null, currency: null, is_demo_price: false, company_claim: null });
});

test("a price takes its currency, uppercased, and keeps the digits as typed", () => {
  const r = parse({ price: " 1250.50 ", currency: "lkr" });
  assert.ok(r.success);
  assert.deepEqual(r.data, { indicative_price: "1250.50", currency: "LKR", is_demo_price: false, company_claim: null });
});

test("a price needs a three-letter currency, a currency alone is dropped with no price", () => {
  assert.ok(problems({ price: "100", currency: "" }).currency);
  assert.ok(problems({ price: "100", currency: "RS" }).currency);
  assert.ok(problems({ price: "100", currency: "LKR1" }).currency);
  const r = parse({ price: "", currency: "USD" });
  assert.ok(r.success);
  assert.equal(r.data.currency, null);
});

test("a typed zero price stays zero, which is different from no price", () => {
  const r = parse({ price: "0" });
  assert.ok(r.success);
  assert.equal(r.data.indicative_price, "0");
});

test("only plain non-negative amounts with at most two decimals are accepted", () => {
  for (const bad of ["-5", "abc", "1e3", "1,000", "10.123", ".5"]) assert.ok(problems({ price: bad }).price, bad);
  assert.deepEqual(problems({ price: "10.12" }), {});
});

test("the claim is trimmed, blank means none, and it is limited to 2000 characters", () => {
  const r = parse({ company_claim: "  25 year warranty  " });
  assert.ok(r.success);
  assert.equal(r.data.company_claim, "25 year warranty");
  assert.deepEqual(problems({ company_claim: "x".repeat(2000) }), {});
  assert.ok(problems({ company_claim: "x".repeat(2001) }).company_claim);
});

const server = { indicative_price: "1000.00", currency: "LKR", is_demo_price: false, company_claim: "Claim" };
const values = (o: Record<string, unknown> = {}) => {
  const r = offerSchema.parse({ ...valuesFromOffer(server), ...o });
  return r;
};

test("unchanged values produce no changes, even when the price is written differently", () => {
  assert.deepEqual(offerChanges(server, values()), {});
  assert.deepEqual(offerChanges(server, values({ price: "1000" })), {});
});

test("a changed price sends the price and its currency together", () => {
  assert.deepEqual(offerChanges(server, values({ price: "1100" })), { indicative_price: "1100", currency: "LKR" });
  assert.deepEqual(offerChanges(server, values({ currency: "USD" })), { indicative_price: "1000.00", currency: "USD" });
});

test("clearing the price clears the currency with it", () => {
  assert.deepEqual(offerChanges(server, values({ price: "" })), { indicative_price: null, currency: null });
});

test("adding a price to an offer that had none sends both", () => {
  const none = { indicative_price: null, currency: null, is_demo_price: false, company_claim: null };
  assert.deepEqual(offerChanges(none, offerSchema.parse({ ...emptyOfferForm, price: "50" })), { indicative_price: "50", currency: "LKR" });
});

test("the sample-price label and the claim change independently, and clearing the claim sends null", () => {
  assert.deepEqual(offerChanges(server, values({ is_demo_price: true })), { is_demo_price: true });
  assert.deepEqual(offerChanges(server, values({ company_claim: "New" })), { company_claim: "New" });
  assert.deepEqual(offerChanges(server, values({ company_claim: "" })), { company_claim: null });
  assert.equal(hasChanges({}), false);
});

test("an offer only ever carries commercial fields, never a specification", () => {
  const body = createBody("p1", values());
  assert.deepEqual(Object.keys(body).sort(), ["company_claim", "currency", "indicative_price", "is_demo_price", "product_id"]);
  for (const changes of [offerChanges(server, values({ price: "1" })), offerChanges(server, values({ company_claim: "x", is_demo_price: true }))]) {
    for (const key of Object.keys(changes)) assert.ok(["indicative_price", "currency", "is_demo_price", "company_claim"].includes(key), key);
  }
});

test("the read-only specification line shows units, and unknown is Not specified, never zero", () => {
  assert.equal(specLine({ kind: "panel", specifications: { wattage_w: "415.000", efficiency_percent: "21.40" } }), "415 W · 21.4 %");
  assert.equal(specLine({ kind: "panel", specifications: { wattage_w: null, efficiency_percent: "0" } }), "Not specified · 0 %");
  assert.equal(specLine({ kind: "inverter", specifications: { category: "hybrid", capacity_kw: "5.0" } }), "Hybrid · 5 kW");
  assert.equal(specLine({ kind: "inverter", specifications: {} }), "Not specified · Not specified");
});
