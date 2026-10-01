import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError, networkError } from "./api/errors.ts";
import { safeReturnPath, signInHref } from "./redirect.ts";
import { deriveSessionState, navigationUser, shouldResetClientState } from "./session.ts";

const profile = {
  role: "customer" as const,
  memberships: [{ company_id: "c1", role: "sales" as const }],
};
const failure = (status: number) =>
  new ApiError({ status, code: status === 401 ? "unauthenticated" : "forbidden", message: "m" });

test("a signed-out browser is signed out, whatever else is cached", () => {
  assert.deepEqual(deriveSessionState({ signedIn: false, profile, error: null }), {
    status: "signed-out",
  });
});

test("signed in without a profile yet is loading, with one it is ready", () => {
  assert.deepEqual(deriveSessionState({ signedIn: true, profile: undefined, error: null }), {
    status: "loading",
  });
  const ready = deriveSessionState({ signedIn: true, profile, error: null });
  assert.equal(ready.status, "ready");
  assert.deepEqual(navigationUser(ready), {
    role: "customer",
    memberships: [{ companyId: "c1", role: "sales" }],
  });
});

test("a 403 means the account is inactive and drops the cached profile", () => {
  // The previous successful profile may still be attached to the failed query.
  const state = deriveSessionState({ signedIn: true, profile, error: failure(403) });
  assert.deepEqual(state, { status: "inactive" });
  assert.equal(navigationUser(state), null);
});

test("a 401 means the session was rejected and drops the cached profile", () => {
  const state = deriveSessionState({ signedIn: true, profile, error: failure(401) });
  assert.deepEqual(state, { status: "rejected" });
  assert.equal(navigationUser(state), null);
});

test("other failures keep the last known profile for navigation only", () => {
  const unavailable = deriveSessionState({ signedIn: true, profile, error: networkError() });
  assert.equal(unavailable.status, "unavailable");
  assert.equal(navigationUser(unavailable)?.role, "customer");
  const none = deriveSessionState({ signedIn: true, profile: undefined, error: failure(503) });
  assert.deepEqual(none, { status: "unavailable", user: null });
  assert.equal(navigationUser(none), null);
});

test("nothing can be assumed about the user while signed out, loading or refused", () => {
  for (const state of [
    deriveSessionState({ signedIn: false, profile: undefined, error: null }),
    deriveSessionState({ signedIn: true, profile: undefined, error: null }),
    deriveSessionState({ signedIn: true, profile, error: failure(403) }),
  ]) {
    assert.equal(navigationUser(state), null, state.status);
  }
});

test("client state resets whenever the person using the browser changes", () => {
  assert.equal(shouldResetClientState("user_a", null), true); // signed out
  assert.equal(shouldResetClientState(null, "user_a"), true); // signed in
  assert.equal(shouldResetClientState("user_a", "user_b"), true); // switched accounts
  assert.equal(shouldResetClientState("user_a", "user_a"), false);
  assert.equal(shouldResetClientState(null, null), false);
  // Clerk has not finished loading: do not treat that as a change.
  assert.equal(shouldResetClientState(undefined, "user_a"), false);
  assert.equal(shouldResetClientState("user_a", undefined), false);
});

test("sign-in return paths stay on this site", () => {
  assert.equal(safeReturnPath("/account"), "/account");
  assert.equal(safeReturnPath("/my/requests/abc"), "/my/requests/abc");
  for (const unsafe of [
    "https://evil.test/",
    "//evil.test/x",
    "/\\evil.test",
    "javascript:alert(1)",
    "account",
    "",
    null,
    undefined,
    "/sign-in",
    "/sign-up/verify",
    "/path\nwith-newline",
  ]) {
    assert.equal(safeReturnPath(unsafe), "/", String(unsafe));
  }
});

test("signInHref returns to the current page, and plain sign-in from home or unsafe paths", () => {
  assert.equal(signInHref("/account"), "/sign-in?redirect_url=%2Faccount");
  assert.equal(signInHref("/"), "/sign-in");
  assert.equal(signInHref("//evil.test"), "/sign-in");
  assert.equal(signInHref(undefined), "/sign-in");
});
