import assert from "node:assert/strict";
import test from "node:test";

import { contrastRatio } from "./contrast.ts";
import { CONTRAST_RULES, DARK, DECORATIVE_ONLY_ON_LIGHT, LIGHT, type ContrastRule, type Theme } from "./tokens.ts";

const maps: Record<Theme, Record<string, string>> = { light: LIGHT, dark: DARK };

/** Every rule that a token set fails, as readable text. */
function failures(rules: ContrastRule[], tokens: Record<Theme, Record<string, string>>): string[] {
  return rules.flatMap((rule) => {
    const foreground = tokens[rule.theme][rule.foreground];
    const background = tokens[rule.theme][rule.background];
    if (!foreground || !background) return [`${rule.theme}: unknown token in ${rule.foreground} on ${rule.background}`];
    const ratio = contrastRatio(foreground, background);
    return ratio >= rule.minimum ? [] : [`${rule.theme}: ${rule.foreground} on ${rule.background} is ${ratio.toFixed(2)} (needs ${rule.minimum}) for ${rule.use}`];
  });
}

test("the contrast formula matches known values", () => {
  assert.equal(contrastRatio("#000000", "#FFFFFF"), 21);
  assert.equal(contrastRatio("#FFFFFF", "#000000"), 21);
  assert.equal(contrastRatio("#FBF8F3", "#FBF8F3"), 1);
  assert.ok(Math.abs(contrastRatio("#767676", "#FFFFFF") - 4.54) < 0.01);
  assert.throws(() => contrastRatio("orange", "#FFFFFF"));
});

test("every token is a six digit hex colour", () => {
  for (const [name, value] of [...Object.entries(LIGHT), ...Object.entries(DARK)]) {
    assert.match(value, /^#[0-9A-F]{6}$/, name);
  }
});

test("every text, graphic, border and focus pair meets its minimum in both themes", () => {
  assert.deepEqual(failures(CONTRAST_RULES, maps), []);
});

test("the check really fails when a pair drops: white on the orange fill is caught", () => {
  const broken = { light: { ...LIGHT, onOrange: "#FFFFFF" }, dark: DARK };
  const found = failures(CONTRAST_RULES, broken);
  assert.ok(found.some((line) => line.includes("onOrange on orange")), found.join("\n"));
});

test("the check fails for muted text that is too pale, in either theme", () => {
  assert.ok(failures(CONTRAST_RULES, { light: { ...LIGHT, ink3: "#A89B8C" }, dark: DARK }).length > 0);
  assert.ok(failures(CONTRAST_RULES, { light: LIGHT, dark: { ...DARK, muted: "#5A4E43" } }).length > 0);
});

test("both themes cover the same roles", () => {
  const roles = (rules: ContrastRule[], theme: Theme) => new Set(rules.filter((rule) => rule.theme === theme).map((rule) => rule.use));
  assert.deepEqual(roles(CONTRAST_RULES, "light"), roles(CONTRAST_RULES, "dark"));
});

test("text on an orange button is dark ink in both themes, never white", () => {
  for (const theme of ["light", "dark"] as const) {
    const onOrange = maps[theme].onOrange ?? "";
    assert.ok(contrastRatio(onOrange, "#000000") < contrastRatio(onOrange, "#FFFFFF"), theme);
  }
});

test("the orange fill is never an essential graphic on a light surface", () => {
  for (const name of DECORATIVE_ONLY_ON_LIGHT) {
    const used = CONTRAST_RULES.filter((rule) => rule.theme === "light" && rule.foreground === name && rule.minimum > 0 && rule.use !== "label on an orange button");
    assert.deepEqual(used, [], name);
    assert.ok(contrastRatio(LIGHT.orange, LIGHT.paper) < 3);
  }
});
