import assert from "node:assert/strict";
import { test } from "node:test";

import { en } from "./en.ts";
import { format, plural } from "./format.ts";

test("format fills placeholders and leaves unknown ones visible", () => {
  assert.equal(format("Wait {seconds} s", { seconds: 60 }), "Wait 60 s");
  assert.equal(format("{a} and {b}", { a: "x" }), "x and {b}");
  assert.equal(format("No placeholders", {}), "No placeholders");
});

test("plural picks the singular only for one", () => {
  const forms = { one: "{n} second", other: "{n} seconds" };
  assert.equal(plural(forms, 1), "{n} second");
  assert.equal(plural(forms, 0), "{n} seconds");
  assert.equal(plural(forms, 2), "{n} seconds");
});

test("every message is non-empty and every placeholder is a simple word", () => {
  const visit = (node: unknown, path: string) => {
    if (typeof node === "string") {
      assert.ok(node.trim().length > 0, `${path} is empty`);
      for (const placeholder of node.match(/\{[^}]*\}/g) ?? []) {
        assert.match(placeholder, /^\{\w+\}$/, `${path}: ${placeholder}`);
      }
    } else if (typeof node === "object" && node !== null) {
      for (const [key, value] of Object.entries(node)) visit(value, `${path}.${key}`);
    }
  };
  visit(en, "en");
});
