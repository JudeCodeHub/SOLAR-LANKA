import assert from "node:assert/strict";
import { test } from "node:test";

import type { District, Service } from "../directory/options.ts";
import {
  canSubmit,
  completeness,
  hasChanges,
  profileChanges,
  profileSchema,
  resolveCompany,
  savingEffect,
  staffCompanies,
  valuesFromProfile,
} from "./profile.ts";

const D = (...v: District[]) => v;
const S = (...v: Service[]) => v;
const m = (id: string, role: string) => ({ company_id: id, company_name: `Company ${id}`, role });
const server = {
  name: "Acme Solar",
  service_districts: ["Kandy", "Colombo"],
  services: ["repair", "installation"],
  declared_credentials: [{ name: "Cert A", issuer: "Board" }],
};

test("only company administrators and sales are staff who may manage a profile", () => {
  assert.deepEqual(staffCompanies([m("a", "company_admin"), m("b", "technician"), m("c", "sales")]).map((x) => x.company_id), ["a", "c"]);
  assert.deepEqual(staffCompanies([m("b", "technician")]), []);
  assert.deepEqual(staffCompanies([]), []);
});

test("with no staff membership there is nothing to manage, and a technician is told why", () => {
  assert.deepEqual(resolveCompany([], null), { kind: "none", technicianOnly: false });
  assert.deepEqual(resolveCompany([m("b", "technician")], null), { kind: "none", technicianOnly: true });
});

test("one company is opened directly, several ask which", () => {
  assert.equal(resolveCompany([m("a", "sales")], null).kind, "ok");
  assert.equal(resolveCompany([m("a", "sales"), m("b", "company_admin")], null).kind, "choose");
});

test("THE ADDRESS CANNOT REACH ANOTHER COMPANY: only the user's own memberships are accepted", () => {
  const mine = [m("a", "company_admin")];
  assert.equal(resolveCompany(mine, "a").kind, "ok");
  assert.equal(resolveCompany(mine, "other").kind, "not-yours");
  // A company where the user is only a technician is not theirs to manage.
  assert.equal(resolveCompany([m("a", "company_admin"), m("t", "technician")], "t").kind, "not-yours");
  assert.equal(resolveCompany([], "a").kind, "none");
});

test("unchanged values produce no changes, whatever order lists were stored in", () => {
  const values = valuesFromProfile(server);
  assert.deepEqual(profileChanges(server, values), {});
  assert.equal(hasChanges(profileChanges(server, { ...values, service_districts: D("Colombo", "Kandy") })), false);
});

test("only the fields that really changed are sent", () => {
  const values = valuesFromProfile(server);
  assert.deepEqual(profileChanges(server, { ...values, name: "  New Name " }), { name: "New Name" });
  assert.deepEqual(profileChanges(server, { ...values, services: S("installation") }), { services: S("installation") });
  assert.deepEqual(profileChanges(server, { ...values, declared_credentials: [] }), { declared_credentials: [] });
  assert.deepEqual(profileChanges(server, { ...values, declared_credentials: [{ name: "Cert A", issuer: "Board" }, { name: "B", issuer: "C" }] }), {
    declared_credentials: [{ name: "Cert A", issuer: "Board" }, { name: "B", issuer: "C" }],
  });
});

test("clearing a list is a change that sends an empty list, never null", () => {
  const values = valuesFromProfile(server);
  assert.deepEqual(profileChanges(server, { ...values, service_districts: D() }), { service_districts: D() });
});

test("checkboxes show districts and services in a fixed order", () => {
  assert.deepEqual(valuesFromProfile(server).service_districts, ["Colombo", "Kandy"]);
  assert.deepEqual(valuesFromProfile(server).services, ["installation", "repair"]);
});

test("the form schema needs a name and complete credentials, and refuses unknown districts", () => {
  const ok = { name: "A", service_districts: ["Colombo"], services: ["repair"], declared_credentials: [{ name: "x", issuer: "y" }] };
  assert.ok(profileSchema.safeParse(ok).success);
  assert.ok(!profileSchema.safeParse({ ...ok, name: "   " }).success);
  assert.ok(!profileSchema.safeParse({ ...ok, service_districts: ["Atlantis"] }).success);
  assert.ok(!profileSchema.safeParse({ ...ok, declared_credentials: [{ name: "x", issuer: "" }] }).success);
  assert.ok(!profileSchema.safeParse({ ...ok, declared_credentials: Array.from({ length: 21 }, () => ({ name: "x", issuer: "y" })) }).success);
});

test("completeness says whether the profile can receive requests (a district and installation)", () => {
  assert.equal(completeness(server).canReceiveRequests, true);
  assert.equal(completeness({ ...server, services: ["repair"] }).canReceiveRequests, false);
  assert.equal(completeness({ ...server, service_districts: [] }).canReceiveRequests, false);
});

test("saving warns about the listing for every status except draft", () => {
  assert.equal(savingEffect("draft"), "none");
  assert.equal(savingEffect("pending"), "withdraws");
  assert.equal(savingEffect("approved"), "unlists");
  assert.equal(savingEffect("rejected"), "reopens");
});

test("only a draft or rejected profile can be submitted", () => {
  assert.equal(canSubmit("draft"), true);
  assert.equal(canSubmit("rejected"), true);
  assert.equal(canSubmit("pending"), false);
  assert.equal(canSubmit("approved"), false);
});
