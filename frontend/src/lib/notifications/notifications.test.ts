import assert from "node:assert/strict";
import test from "node:test";

import { destinationFor, parseFilter } from "./notifications.ts";

const target = { target_kind: "installation", target_id: "3f2b8c1e-0a4d-4f5e-9c7b-1d2e3f4a5b6c" };

test("a customer is sent to their own installation page", () => {
  assert.equal(destinationFor(target, [])?.href, `/my/installations/${target.target_id}`);
  assert.equal(destinationFor(target, [{ role: "technician" }])?.href, `/my/installations/${target.target_id}`);
});

test("company administrators and sales are sent to the company's installation page", () => {
  assert.equal(destinationFor(target, [{ role: "sales" }])?.href, `/company/installations/${target.target_id}`);
  assert.equal(destinationFor(target, [{ role: "company_admin" }])?.href, `/company/installations/${target.target_id}`);
});

test("a notification that names nothing this app can open has no link", () => {
  assert.equal(destinationFor({ target_kind: null, target_id: null }, []), null);
  assert.equal(destinationFor({ target_kind: "billing", target_id: target.target_id }, []), null);
});

test("only unread is a filter; anything else shows everything", () => {
  assert.equal(parseFilter("unread"), "unread");
  assert.equal(parseFilter("read"), "all");
  assert.equal(parseFilter(null), "all");
});

test("a support notification opens the support request on the person's own side", () => {
  const id = target.target_id;
  assert.equal(destinationFor({ target_kind: "support_case", target_id: id }, [])?.href, `/my/support/${id}`);
  assert.equal(destinationFor({ target_kind: "support_case", target_id: id }, [{ role: "technician" }])?.href, `/technician/support/${id}`);
  assert.equal(destinationFor({ target_kind: "support_case", target_id: id }, [{ role: "sales" }])?.href, `/company/support/${id}`);
});

test("reminders open the offer's request and the technician's visit", () => {
  const id = target.target_id;
  assert.equal(destinationFor({ target_kind: "request", target_id: id }, [])?.href, `/my/requests/${id}`);
  assert.equal(destinationFor({ target_kind: "site_visit", target_id: id }, [{ role: "technician" }])?.href, `/technician/visits/${id}`);
});
