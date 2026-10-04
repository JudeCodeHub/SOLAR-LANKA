import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { test as base } from "@playwright/test";

import { type IdentityName, IDENTITIES } from "./identities.ts";
import { ensureKeys, signToken } from "./support/jwt.ts";
import { API_PORT, BACKEND_DIR, E2E_DIR, FAIL_FILE, IDENTITY_FILE, TMP_DIR } from "./support/paths.ts";

export interface ApiResult {
  status: number;
  body: unknown;
  /** The raw bytes of a response that is not JSON, such as a downloaded file. */
  bytes?: Buffer;
}

interface Fixtures {
  /** Make the browser and the gateway act as this demo person (or as nobody). */
  signInAs: (who: IdentityName | null) => void;
  /** Call the API directly as a demo person, for preparing or checking data without the UI. */
  api: (who: IdentityName, method: string, path: string, body?: unknown, headers?: Record<string, string>) => Promise<ApiResult>;
  /** Make every write fail for the rest of the test, to see how screens recover. */
  failWrites: () => void;
  /** Move a confirmed visit into the past so it can be completed (the API refuses past slots). */
  startVisit: (visitId: string) => void;
  /** Do what the background worker would: turn pending events into notifications (there is no Inngest in these tests). */
  processOutbox: () => void;
  /** Run the reminder job once, as the scheduler would (there is no Inngest in these tests). */
  runReminders: () => void;
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
      if (!(response.headers.get("content-type") ?? "").includes("json")) {
        const bytes = Buffer.from(await response.arrayBuffer());
        return { status: response.status, body: null, bytes };
      }
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : null };
    });
  },
  startVisit: async ({}, provide) => {
    await provide((visitId) => {
      const result = spawnSync(join(BACKEND_DIR, ".venv", "bin", "python"), [join(E2E_DIR, "support", "backdate.py"), visitId], {
        env: { ...process.env, PYTHONPATH: BACKEND_DIR },
        encoding: "utf8",
      });
      if (result.status !== 0) throw new Error(`Could not start the visit: ${result.stderr}`);
    });
  },
  processOutbox: async ({}, provide) => {
    await provide(() => {
      const result = spawnSync(join(BACKEND_DIR, ".venv", "bin", "python"), ["-m", "app.jobs.process_outbox_locally"], {
        cwd: BACKEND_DIR,
        env: { ...process.env, SOLAR_DATABASE_URL: process.env.E2E_DATABASE_URL, SOLAR_ENVIRONMENT: "development", PYTHONPATH: BACKEND_DIR },
        encoding: "utf8",
      });
      if (result.status !== 0) throw new Error(`Processing the outbox failed: ${result.stderr}`);
    });
  },
  runReminders: async ({}, provide) => {
    await provide(() => {
      const result = spawnSync(join(BACKEND_DIR, ".venv", "bin", "python"), ["-m", "app.jobs.send_reminders"], {
        cwd: BACKEND_DIR,
        env: { ...process.env, SOLAR_DATABASE_URL: process.env.E2E_DATABASE_URL, SOLAR_ENVIRONMENT: "development", PYTHONPATH: BACKEND_DIR },
        encoding: "utf8",
      });
      if (result.status !== 0) throw new Error(`Running the reminders failed: ${result.stderr}`);
    });
  },
  failWrites: async ({}, provide) => {
    await provide(() => writeFileSync(FAIL_FILE, "writes"));
    rmSync(FAIL_FILE, { force: true });
  },
});

export { expect } from "@playwright/test";
