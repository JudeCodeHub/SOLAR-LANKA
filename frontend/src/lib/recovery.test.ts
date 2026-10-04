import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..", "..", "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");

function files(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    if (["node_modules", "__pycache__", ".venv", ".next"].includes(name)) return [];
    const path = join(directory, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

test("sign-in and account pages are Clerk's, which provide password recovery", () => {
  assert.match(source("frontend/src/app/sign-in/[[...sign-in]]/page.tsx"), /<SignIn \/>/);
  assert.match(source("frontend/src/app/account/[[...user-profile]]/page.tsx"), /<UserProfile/);
});

test("no custom password-recovery or reset-token system exists", () => {
  const pattern = /reset[-_ ]?password|password[-_ ]?reset|recovery[-_ ]?token|reset[-_ ]?token|forgot[-_ ]?password/i;
  const searched = ["frontend/src", "backend/app", "backend/alembic"].flatMap((directory) =>
    files(join(root, directory)).filter((path) => /\.(ts|tsx|py)$/.test(path) && !path.endsWith("recovery.test.ts")),
  );
  assert.ok(searched.length > 100);
  assert.deepEqual(
    searched.filter((path) => pattern.test(readFileSync(path, "utf8"))),
    [],
  );
});
