import { mkdirSync, rmSync, writeFileSync } from "node:fs";

import { test as base } from "@playwright/test";

import { type IdentityName, IDENTITIES } from "./identities.ts";
import { ensureKeys, signToken } from "./support/jwt.ts";
import { API_PORT, FAIL_FILE, IDENTITY_FILE, TMP_DIR } from "./support/paths.ts";

export interface ApiResult {
  status: number;
  body: unknown;
}

interface Fixtures {
  /** Make the browser and the gateway act as this demo person (or as nobody). */
  signInAs: (who: IdentityName | null) => void;
  /** Call the API directly as a demo person, for preparing or checking data without the UI. */
  api: (who: IdentityName, method: string, path: string, body?: unknown, headers?: Record<string, string>) => Promise<ApiResult>;
  /** Make every write fail for the rest of the test, to see how screens recover. */
  failWrites: () => void;
}

export const test = base.extend<Fixtures>({
  signInAs: async ({}, provide) => {
    mkdirSync(TMP_DIR, { recursive: true });
    await provide((who) => {
      if (who === null) rmSync(IDENTITY_FILE, { force: true });
      else writeFileSync(IDENTITY_FILE, IDENTITIES[who].subject);
    });
    rmSync(IDENTITY_FILE, { force: true });
  },
  api: async ({}, provide) => {
    const { privateKey } = ensureKeys();
    await provide(async (who, method, path, body, headers) => {
      const response = await fetch(`http://127.0.0.1:${API_PORT}${path}`, {
        method,
        headers: { authorization: `Bearer ${signToken(IDENTITIES[who].subject, privateKey)}`, ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : null };
    });
  },
  failWrites: async ({}, provide) => {
    await provide(() => writeFileSync(FAIL_FILE, "writes"));
    rmSync(FAIL_FILE, { force: true });
  },
});

export { expect } from "@playwright/test";
