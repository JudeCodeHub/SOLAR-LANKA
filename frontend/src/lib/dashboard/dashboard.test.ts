import assert from "node:assert/strict";
import test from "node:test";

import { companyActions, customerActions } from "./dashboard.ts";

const ids = (actions: { id: string }[]) => actions.map((a) => a.id);

test("a customer with nothing yet is pointed to an estimate and a request", () => {
  assert.deepEqual(ids(customerActions({ totalRequests: 0, activeRequests: 0, openOffers: 0, unread: 0, installationsInProgress: 0 })), ["estimate", "request"]);
});

test("offers ending soon come before everything else and link to the request holding them", () => {
  const actions = customerActions({ totalRequests: 2, activeRequests: 2, openOffers: 3, expiringSoon: 1, urgentRequestId: "r1", unread: 2 });
  assert.deepEqual(ids(actions), ["expiring", "offers", "unread"]);
  assert.equal(actions[0]?.href, "/my/requests/r1");
});

test("a customer waiting on companies is told to follow the requests, not to decide anything", () => {
  assert.deepEqual(ids(customerActions({ totalRequests: 1, activeRequests: 1, openOffers: 0 })), ["follow"]);
});

test("counts that are still unknown produce no action", () => {
  assert.deepEqual(customerActions({}), []);
  assert.deepEqual(companyActions({}, "c1"), []);
});

test("a company with an unfinished profile is told first, with its own company in the links", () => {
  const actions = companyActions({ profileStatus: "draft", newEnquiries: 2, offerCount: 0, installationsInProgress: 1 }, "c1");
  assert.deepEqual(ids(actions), ["profile", "enquiries", "installations", "offers"]);
  assert.ok(actions.slice(0, 3).every((a) => a.href.includes("company=c1")));
});

test("a pending or approved profile needs no action, and a rejected one does", () => {
  assert.deepEqual(companyActions({ profileStatus: "pending" }, "c1"), []);
  assert.deepEqual(ids(companyActions({ profileStatus: "rejected" }, "c1")), ["profile"]);
});
