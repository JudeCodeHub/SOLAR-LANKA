import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const src = join(import.meta.dirname, "..", "..");
const css = readFileSync(join(src, "app", "globals.css"), "utf8");
const utility = (name: string) => css.match(new RegExp(`@utility ${name} \\{([\\s\\S]*?)\\n\\}\\n`))?.[1] ?? "";

function files(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".tsx") ? [path] : [];
  });
}

test("the field utilities exist and use the contrast-tested tokens", () => {
  for (const name of ["field-control", "field-select", "field-check", "field-radio", "field-switch"]) assert.ok(utility(name).length > 0, name);
  assert.match(utility("field-control"), /var\(--ds-field-border\)/);
  assert.match(utility("field-control"), /min-height: 2\.75rem/);
  assert.match(utility("field-control"), /aria-invalid="true"/);
  assert.match(utility("field-control"), /:disabled/);
  assert.match(utility("field-check"), /:checked/);
  assert.match(utility("field-switch"), /prefers-reduced-motion: reduce/);
});

test("no page or component still draws its own plain text-field border", () => {
  const old = /rounded-lg border bg-(transparent|background)|border-input bg-transparent/;
  assert.deepEqual(files(src).filter((file) => old.test(readFileSync(file, "utf8"))), []);
});

test("every checkbox and radio uses the shared look", () => {
  const problems: string[] = [];
  for (const file of files(src)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (!/type="(checkbox|radio)"/.test(line)) return;
      const window = lines.slice(Math.max(0, index - 2), index + 9).join(" ");
      if (!/field-(check|radio|switch)/.test(window)) problems.push(`${file}:${index + 1}`);
    });
  }
  assert.deepEqual(problems, []);
});

test("error text is red with weight and text help is the muted token", () => {
  const field = readFileSync(join(src, "components", "ui", "field.tsx"), "utf8");
  assert.match(field, /text-sm font-medium text-danger/);
  assert.match(field, /text-ink-3/);
});
