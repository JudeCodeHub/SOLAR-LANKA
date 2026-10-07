import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { formatAmount, formatKw, formatKwh, formatKwp } from "./figures.ts";

test("money has the code, a thousands separator and two decimals", () => {
  assert.equal(formatAmount("450000"), "LKR 450,000.00");
  assert.equal(formatAmount("1999.5", "USD"), "USD 1,999.50");
  assert.equal(formatAmount(0), "LKR 0.00");
  assert.equal(formatAmount("oops"), null);
  assert.equal(formatAmount(null), null);
  assert.equal(formatAmount("", "LKR"), null);
});

test("units follow the number after one space, with trailing zeros dropped", () => {
  assert.equal(formatKwp("5.450"), "5.45 kWp");
  assert.equal(formatKw(5.4), "5.4 kW");
  assert.equal(formatKwh("7800"), "7,800 kWh");
  assert.equal(formatKwp(null), null);
  assert.equal(formatKwh("x"), null);
});

test("only the figures module builds a money string", () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) && !/\.test\.ts$/.test(name) && !path.includes("/design/") && !path.includes("/messages/") ? [path] : [];
  });
  for (const file of walk(join(import.meta.dirname, ".."))) {
    if (file.endsWith("format/figures.ts")) continue;
    assert.doesNotMatch(readFileSync(file, "utf8"), /`LKR |minimumFractionDigits: 2/, file);
  }
});
