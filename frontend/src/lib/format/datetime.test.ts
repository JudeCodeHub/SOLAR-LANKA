import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { formatDate, formatDateTime } from "./datetime.ts";

test("dates are written in full, in the zone asked for", () => {
  assert.equal(formatDate("2026-09-15T20:00:00Z"), "16 September 2026");
  assert.equal(formatDate("2026-09-15T20:00:00Z", "UTC"), "15 September 2026");
  assert.equal(formatDate("nonsense"), "");
});

test("a moment carries its zone name and a 24-hour clock", () => {
  assert.equal(formatDateTime("2026-09-15T09:00:00Z"), "15 Sept 2026, 14:30 UTC+5:30".replace("UTC", "GMT"));
  assert.match(formatDateTime("2026-09-15T21:00:00Z", "UTC"), /^15 Sept 2026, 21:00 UTC$/);
  assert.equal(formatDateTime("nonsense"), "");
});

test("no page formats a date by hand", () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) && !/test\.ts$/.test(name) ? [path] : [];
  });
  const src = join(import.meta.dirname, "..", "..");
  for (const file of walk(src)) {
    const source = readFileSync(file, "utf8");
    if (file.endsWith("format/datetime.ts") || file.endsWith("visits/slots.ts") || file.endsWith("visits/schedule.ts")) continue;
    assert.doesNotMatch(source, /toLocale(Date|Time)?String\("en-GB"|DateTimeFormat\(/, file);
  }
});
