import assert from "node:assert/strict";
import test from "node:test";

import { applyTheme, parseChoice, resolveTheme, THEME_KEY, THEME_SCRIPT } from "./theme.ts";

test("only light, dark and system are accepted; anything else follows the device", () => {
  assert.equal(parseChoice("light"), "light");
  assert.equal(parseChoice("dark"), "dark");
  assert.equal(parseChoice("system"), "system");
  for (const bad of [null, undefined, "", "Dark", "blue"]) assert.equal(parseChoice(bad), "system");
});

test("system follows the device and the others ignore it", () => {
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});

function fakePage(stored: string | null, prefersDark: boolean) {
  const classes = new Set<string>();
  const root = { classList: { toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)) }, dataset: {} as Record<string, string> };
  const window = { matchMedia: () => ({ matches: prefersDark }) };
  const localStorage = { getItem: (key: string) => (key === THEME_KEY ? stored : null) };
  new Function("document", "window", "localStorage", THEME_SCRIPT)({ documentElement: root }, window, localStorage);
  return { dark: classes.has("dark"), theme: root.dataset.theme };
}

test("the head script applies the saved choice, or the device setting, before paint", () => {
  assert.deepEqual(fakePage("dark", false), { dark: true, theme: "dark" });
  assert.deepEqual(fakePage("light", true), { dark: false, theme: "light" });
  assert.deepEqual(fakePage(null, true), { dark: true, theme: "dark" });
  assert.deepEqual(fakePage("system", false), { dark: false, theme: "light" });
  assert.deepEqual(fakePage("nonsense", true), { dark: true, theme: "dark" });
});

test("a blocked store does not break the page", () => {
  const root = { classList: { toggle: () => undefined }, dataset: {} as Record<string, string> };
  const localStorage = { getItem: () => { throw new Error("blocked"); } };
  assert.doesNotThrow(() => new Function("document", "window", "localStorage", THEME_SCRIPT)({ documentElement: root }, { matchMedia: () => ({ matches: false }) }, localStorage));
});

test("applyTheme sets the class and the data attribute together", () => {
  const classes = new Set<string>();
  const root = { classList: { toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)) }, dataset: {} as Record<string, string> };
  applyTheme("dark", root as unknown as HTMLElement);
  assert.ok(classes.has("dark"));
  assert.equal(root.dataset.theme, "dark");
  applyTheme("light", root as unknown as HTMLElement);
  assert.ok(!classes.has("dark"));
  assert.equal(root.dataset.theme, "light");
});
