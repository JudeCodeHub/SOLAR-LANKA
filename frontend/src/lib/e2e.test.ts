import assert from "node:assert/strict";
import test from "node:test";

import { authBypass } from "./e2e.ts";

test("the test sign-in bypass needs an explicit switch", () => {
  assert.equal(authBypass({}), false);
  assert.equal(authBypass({ E2E_AUTH: "0" }), false);
  assert.equal(authBypass({ E2E_AUTH: "true" }), false);
  assert.equal(authBypass({ E2E_AUTH: "1", NODE_ENV: "development" }), true);
});

test("the bypass can never be on in production, whatever the switch says", () => {
  assert.equal(authBypass({ E2E_AUTH: "1", NODE_ENV: "production" }), false);
});
