import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { test } from "node:test";

import {
  isActive,
  NAV_ITEMS,
  navigationFor,
  type NavItem,
  publicEntryPoints,
  type ShellUser,
  toShellUser,
} from "./navigation.ts";

// The real registry marks unbuilt pages unavailable. These tests use a copy with everything
// available to check the role rules themselves, independent of what is built today.
const everythingBuilt: NavItem[] = NAV_ITEMS.map((item) => ({ ...item, available: true }));
const ids = (user: ShellUser | null, signedIn: boolean) =>
  navigationFor(user, signedIn, everythingBuilt).flatMap((group) =>
    group.items.map((item) => item.id),
  );
const groupIds = (user: ShellUser | null, signedIn: boolean) =>
  navigationFor(user, signedIn, everythingBuilt).map((group) => group.id);

const customer: ShellUser = { role: "customer", memberships: [] };
const staff = (role: "company_admin" | "sales" | "technician"): ShellUser => ({
  role: "customer",
  memberships: [{ companyId: "company-1", role }],
});
const admin: ShellUser = { role: "platform_admin", memberships: [] };

test("a signed-out visitor sees only public pages", () => {
  const visible = navigationFor(null, false, everythingBuilt);
  assert.deepEqual(
    visible.map((group) => group.id),
    ["explore"],
  );
  assert.ok(ids(null, false).includes("panels"));
  assert.ok(!ids(null, false).includes("account"));
});

test("a signed-in user whose profile has not loaded yet sees public and account links", () => {
  assert.deepEqual(groupIds(null, true), ["explore", "account"]);
});

test("a customer sees their own activity and nothing for companies or administration", () => {
  assert.deepEqual(groupIds(customer, true), ["explore", "customer", "account"]);
  assert.ok(ids(customer, true).includes("my-requests"));
  for (const hidden of ["company-inbox", "admin-users", "admin-companies"]) {
    assert.ok(!ids(customer, true).includes(hidden), hidden);
  }
});

test("company administrators and sales staff get the company workspace", () => {
  for (const role of ["company_admin", "sales"] as const) {
    const visible = ids(staff(role), true);
    for (const expected of ["company-inbox", "company-offers", "company-profile"]) {
      assert.ok(visible.includes(expected), `${role} ${expected}`);
    }
    // Staff keep a customer account role, so customer pages stay available to them.
    assert.ok(visible.includes("my-requests"));
    assert.ok(!visible.includes("admin-users"));
  }
});

test("technicians have no company links until their workspace exists", () => {
  assert.ok(!groupIds(staff("technician"), true).includes("company"));
});

test("a suspended or absent membership grants nothing", () => {
  // /users/me lists active memberships only; a user without any is just a customer.
  assert.ok(!groupIds(customer, true).includes("company"));
});

test("platform administrators see administration, not customer or company pages", () => {
  assert.deepEqual(groupIds(admin, true), ["explore", "admin", "account"]);
  assert.ok(!ids(admin, true).includes("my-requests"));
  assert.ok(!ids(admin, true).includes("company-inbox"));
});

test("pages that are not built yet are never shown", () => {
  const unbuilt = NAV_ITEMS.filter((item) => !item.available).map((item) => item.id);
  assert.ok(unbuilt.length > 0);
  for (const user of [customer, staff("sales"), admin]) {
    const shown = navigationFor(user, true).flatMap((group) => group.items.map((item) => item.id));
    for (const id of unbuilt) {
      assert.ok(!shown.includes(id), id);
    }
  }
});

test("link ids and addresses are unique and addresses are absolute paths", () => {
  assert.equal(new Set(NAV_ITEMS.map((item) => item.id)).size, NAV_ITEMS.length);
  assert.equal(new Set(NAV_ITEMS.map((item) => item.href)).size, NAV_ITEMS.length);
  for (const item of NAV_ITEMS) {
    assert.match(item.href, /^\/[a-z0-9/-]*$/, item.id);
  }
});

test("isActive matches a page and the pages below it, but home only itself", () => {
  assert.equal(isActive("/", "/"), true);
  assert.equal(isActive("/", "/account"), false);
  assert.equal(isActive("/account", "/account"), true);
  assert.equal(isActive("/account", "/account/security"), true);
  assert.equal(isActive("/account", "/accounts"), false);
  assert.equal(isActive("/panels", "/panels/abc-123"), true);
});

test("toShellUser maps the profile from the API", () => {
  assert.deepEqual(
    toShellUser({
      role: "customer",
      memberships: [{ company_id: "c1", role: "sales" }],
    }),
    { role: "customer", memberships: [{ companyId: "c1", role: "sales" }] },
  );
});

// --- The registry must agree with the pages that really exist. ---

const APP_DIR = join(import.meta.dirname, "..", "app");

/** Every page.tsx under src/app as a URL pattern: route groups dropped, dynamic parts kept. */
function pageRoutes(): RegExp[] {
  const patterns: RegExp[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.name === "page.tsx") {
        const segments = relative(APP_DIR, directory)
          .split(sep)
          .filter((segment) => segment !== "" && !/^\(.*\)$/.test(segment));
        let source = "";
        for (const segment of segments) {
          if (/^\[\[\.\.\..+\]\]$/.test(segment)) source += "(?:/.*)?"; // optional catch-all
          else if (/^\[\.\.\..+\]$/.test(segment)) source += "/.+"; // catch-all
          else if (/^\[.+\]$/.test(segment)) source += "/[^/]+"; // dynamic segment
          else source += `/${segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
        }
        patterns.push(new RegExp(`^${source === "" ? "/" : source}$`));
      }
    }
  };
  walk(APP_DIR);
  return patterns;
}

test("an item is marked available exactly when a page exists at its address", () => {
  const routes = pageRoutes();
  assert.ok(routes.length > 0, "found no pages under src/app");
  for (const item of NAV_ITEMS) {
    const exists = routes.some((route) => route.test(item.href));
    assert.equal(
      exists,
      item.available,
      `${item.id} (${item.href}): ${exists ? "a page exists, so set available: true" : "no page exists, so set available: false"}`,
    );
  }
});

test("landing entry points link only to pages that exist and exclude home", () => {
  const entries = publicEntryPoints();
  assert.ok(entries.length >= 5);
  assert.ok(!entries.some((entry) => entry.id === "home"));
  // Today none of these pages exist, so none may be a link.
  assert.ok(entries.every((entry) => entry.linkable === NAV_ITEMS.find((i) => i.id === entry.id)?.available));
  // Once a page is built, its entry becomes a real link without any other change.
  const built = publicEntryPoints(everythingBuilt);
  assert.ok(built.every((entry) => entry.linkable));
  // Only public destinations are advertised, never role-specific ones.
  assert.ok(!built.some((entry) => /^(my-|company-|admin-)/.test(entry.id)));
});
