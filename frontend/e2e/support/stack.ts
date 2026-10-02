/**
 * Starts everything a browser test needs besides the web app: a migrated, seeded database,
 * the API verifying test tokens, and the signing proxy the app talks to.
 * Needs E2E_DATABASE_URL: a disposable PostgreSQL database (see the README, "Browser tests").
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { startAuthProxy } from "./auth-proxy.ts";
import { AUTHORIZED_PARTY, ensureKeys, ISSUER } from "./jwt.ts";
import { API_PORT, BACKEND_DIR, TMP_DIR } from "./paths.ts";

const database = process.env.E2E_DATABASE_URL;
if (!database) {
  console.error("Set E2E_DATABASE_URL to a disposable PostgreSQL database for the browser tests.");
  process.exit(1);
}

mkdirSync(TMP_DIR, { recursive: true });
const { publicKey } = ensureKeys();
const python = join(BACKEND_DIR, ".venv", "bin", "python");
const env = {
  ...process.env,
  SOLAR_DATABASE_URL: database,
  SOLAR_ENVIRONMENT: "development",
  SOLAR_CLERK_ISSUER: ISSUER,
  SOLAR_CLERK_AUTHORIZED_PARTIES: JSON.stringify([AUTHORIZED_PARTY]),
  SOLAR_CLERK_JWT_KEY: publicKey,
  SOLAR_CLERK_SECRET_KEY: "sk_test_dummy",
  PYTHONPATH: BACKEND_DIR,
};

for (const args of [["-m", "alembic", "upgrade", "head"], ["-m", "app.seed_e2e"]]) {
  const result = spawnSync(python, args, { cwd: BACKEND_DIR, env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const api = spawn(python, ["-m", "uvicorn", "app.main:create_app", "--factory", "--port", String(API_PORT)], { cwd: BACKEND_DIR, env, stdio: "inherit" });
const proxy = startAuthProxy();
const stop = () => {
  api.kill();
  proxy.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
api.on("exit", (code) => process.exit(code ?? 1));
