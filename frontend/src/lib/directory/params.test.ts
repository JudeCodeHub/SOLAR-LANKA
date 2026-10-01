import assert from "node:assert/strict";
import { test } from "node:test";

import { backHref, isCompanyId, profileHref } from "./links.ts";
import { DISTRICTS, SERVICES } from "./options.ts";
import { buildDirectoryHref, needsCanonicalRedirect, parseDirectoryParams } from "./params.ts";

test("an empty address gives an empty valid state on page 1", () => {
  assert.deepEqual(parseDirectoryParams({}), { values: {}, apiQuery: {}, errors: {}, page: 1 });
});

test("a valid district and service are sent to the backend under its own names", () => {
  const state = parseDirectoryParams({ district: " Colombo ", service: "repair", page: "2" });
  assert.deepEqual(state.apiQuery, { district: "Colombo", service: "repair" });
  assert.deepEqual(state.errors, {});
  assert.equal(state.page, 2);
});

test("every district and service the backend allows is accepted", () => {
  for (const district of DISTRICTS) {
    assert.equal(parseDirectoryParams({ district }).apiQuery.district, district);
  }
  for (const service of SERVICES) {
    assert.equal(parseDirectoryParams({ service }).apiQuery.service, service);
  }
});

test("an unknown or wrongly cased value is reported, kept for the form, and not sent", () => {
  const state = parseDirectoryParams({ district: "colombo", service: "plumbing" });
  assert.deepEqual(state.apiQuery, {});
  assert.deepEqual(Object.keys(state.errors).sort(), ["district", "service"]);
  assert.equal(state.values.district, "colombo");
});

test("a repeated parameter uses the first value and asks for a clean address", () => {
  const raw = { district: ["Kandy", "Galle"] };
  const state = parseDirectoryParams(raw);
  assert.equal(state.apiQuery.district, "Kandy");
  assert.equal(needsCanonicalRedirect(raw, state), true);
});

test("the canonical address omits blanks and page 1 and keeps a stable order", () => {
  assert.equal(buildDirectoryHref("/companies", { values: {}, page: 1 }), "/companies");
  assert.equal(
    buildDirectoryHref("/companies", { values: { service: "repair", district: "Nuwara Eliya" }, page: 3 }),
    "/companies?district=Nuwara+Eliya&service=repair&page=3",
  );
});

test("blank form fields redirect to the clean address, a clean address does not", () => {
  const blank = { district: "", service: "" };
  assert.equal(needsCanonicalRedirect(blank, parseDirectoryParams(blank)), true);
  const clean = { district: "Colombo" };
  assert.equal(needsCanonicalRedirect(clean, parseDirectoryParams(clean)), false);
  const pageOne = { page: "1" };
  assert.equal(needsCanonicalRedirect(pageOne, parseDirectoryParams(pageOne)), true);
});

test("a profile link remembers the filtered list and back only follows the directory", () => {
  const id = "0b2f8a4e-5c1d-4f3a-9b7e-1a2b3c4d5e6f";
  assert.equal(profileHref(id, "/companies"), `/companies/${id}`);
  const list = "/companies?district=Colombo&page=2";
  const remembered = new URL(profileHref(id, list), "http://x").searchParams.get("from") ?? undefined;
  assert.equal(backHref(remembered), list);
  for (const hostile of ["https://evil.example", "//evil.example", "/account", "/companies/../account", "/companies?x#y", "/companies\\x", undefined]) {
    assert.equal(backHref(hostile), "/companies", String(hostile));
  }
});

test("only well-formed ids are looked up", () => {
  assert.equal(isCompanyId("0b2f8a4e-5c1d-4f3a-9b7e-1a2b3c4d5e6f"), true);
  assert.equal(isCompanyId("not-an-id"), false);
  assert.equal(isCompanyId("../etc"), false);
});
