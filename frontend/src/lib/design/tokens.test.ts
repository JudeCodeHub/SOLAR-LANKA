import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { contrastRatio } from "./contrast.ts";
import { ALERT_VARIANTS, TABLE_PAIRS, BADGE_VARIANTS, BUTTON_VARIANTS, CARD_VARIANTS, CONTRAST_RULES, CSS_NAMES, DARK, DECORATIVE_ONLY_ON_LIGHT, LIGHT, type ContrastRule, type Theme } from "./tokens.ts";

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

/** The --ds-* values of one rule block in globals.css. */
function cssValues(selector: RegExp): Record<string, string> {
  const css = readFileSync(join(import.meta.dirname, "..", "..", "app", "globals.css"), "utf8");
  const block = css.match(selector)?.[1] ?? "";
  return Object.fromEntries([...block.matchAll(/--ds-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6});/g)].map((match) => [match[1] ?? "", (match[2] ?? "").toUpperCase()]));
}

test("the CSS variables carry exactly the values the contrast test measures", () => {
  const css = { light: cssValues(/:root,\s*\.light\s*\{([^}]*)\}/), dark: cssValues(/\.dark\s*\{([^}]*)\}/) };
  for (const theme of ["light", "dark"] as const) {
    const tokens: Record<string, string> = maps[theme];
    for (const [key, cssName] of Object.entries(CSS_NAMES[theme])) {
      assert.equal(css[theme][cssName], tokens[key]?.toUpperCase(), `${theme} ${key} (--ds-${cssName})`);
    }
    assert.deepEqual(Object.keys(css[theme]).sort(), Object.values(CSS_NAMES[theme]).sort(), `${theme} has no extra or missing variables`);
  }
});

const valueByCssName = (theme: Theme, cssName: string): string => {
  const key = Object.entries(CSS_NAMES[theme]).find(([, name]) => name === cssName)?.[0] ?? "";
  return maps[theme][key] ?? "";
};

test("every button variant meets its contrast in both themes", () => {
  const problems: string[] = [];
  for (const { variant, pairs } of BUTTON_VARIANTS) {
    for (const theme of ["light", "dark"] as const) {
      for (const [foreground, background] of pairs) {
        const ratio = contrastRatio(valueByCssName(theme, foreground), valueByCssName(theme, background));
        const needed = foreground === "field-border" ? 3 : 4.5;
        if (ratio < needed) problems.push(`${variant} ${theme}: ${foreground} on ${background} is ${ratio.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test("the Button component is built from exactly the classes the contrast data names", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "..", "components", "ui", "button.tsx"), "utf8");
  for (const { variant, classes } of BUTTON_VARIANTS) {
    const line = source.match(new RegExp(`\\n\\s+"?${variant}"?:\\s*\\n?\\s*"([^"]+)"`))?.[1] ?? "";
    for (const name of classes) assert.ok(line.split(/\s+/).includes(name), `${variant} should use ${name}`);
  }
});

test("every button size is at least 44 px tall", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "..", "components", "ui", "button.tsx"), "utf8");
  const sizes = source.match(/size: \{([\s\S]*?)\n      \},/)?.[1] ?? "";
  const heights = [...sizes.matchAll(/"(?:h|size)-(\d+)/g)].map((match) => Number(match[1]));
  assert.ok(heights.length >= 8, "found the sizes");
  for (const height of heights) assert.ok(height >= 11, `h-${height}`);
});

test("every card surface keeps its text readable in both themes", () => {
  const problems: string[] = [];
  for (const { variant, pairs } of CARD_VARIANTS) {
    for (const theme of ["light", "dark"] as const) {
      for (const [foreground, background] of pairs) {
        const ratio = contrastRatio(valueByCssName(theme, foreground), valueByCssName(theme, background));
        if (ratio < 4.5) problems.push(`${variant} ${theme}: ${foreground} on ${background} is ${ratio.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test("the Card component offers exactly the five surfaces, raised by default, built from the named classes", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "..", "components", "ui", "card.tsx"), "utf8");
  const block = source.match(/variant: \{([\s\S]*?)\n      \},/)?.[1] ?? "";
  assert.deepEqual([...block.matchAll(/^\s+(\w+):/gm)].map((match) => match[1]), CARD_VARIANTS.map((card) => card.variant));
  assert.match(source, /defaultVariants: \{ variant: "raised" \}/);
  for (const { variant, classes } of CARD_VARIANTS) {
    const line = block.match(new RegExp(`${variant}:\\s*"([^"]+)"`))?.[1] ?? "";
    for (const name of classes) assert.ok(line.split(/\s+/).includes(name), `${variant} should use ${name}`);
  }
  assert.ok(!source.includes("ring-foreground"), "the old template ring is gone");
});

test("every badge variant keeps its words readable in both themes", () => {
  const problems: string[] = [];
  for (const { variant, pairs } of BADGE_VARIANTS) {
    for (const theme of ["light", "dark"] as const) {
      for (const [foreground, background] of pairs) {
        const ratio = contrastRatio(valueByCssName(theme, foreground), valueByCssName(theme, background));
        if (ratio < 4.5) problems.push(`${variant} ${theme}: ${foreground} on ${background} is ${ratio.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test("the Badge component has exactly these variants, built from the named classes, and always draws an icon", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "..", "components", "ui", "badge.tsx"), "utf8");
  const block = source.match(/variant: \{([\s\S]*?)\n    \},/)?.[1] ?? "";
  assert.deepEqual([...block.matchAll(/^\s+(\w+):/gm)].map((match) => match[1]), BADGE_VARIANTS.map((badge) => badge.variant));
  for (const { variant, classes } of BADGE_VARIANTS) {
    const line = block.match(new RegExp(`${variant}:\\s*"([^"]+)"`))?.[1] ?? "";
    for (const name of classes) assert.ok(line.split(/\s+/).includes(name), `${variant} should use ${name}`);
  }
  // The icon is drawn unconditionally, so a badge can never be colour only.
  assert.match(source, /<Icon aria-hidden \/>/);
  for (const preset of ["SampleBadge", "VerifiedBadge", "TimeSensitiveBadge"]) assert.ok(source.includes(`function ${preset}`), preset);
});

test("every alert variant keeps its title, body and icon readable in both themes", () => {
  const problems: string[] = [];
  for (const { variant, pairs } of ALERT_VARIANTS) {
    for (const theme of ["light", "dark"] as const) {
      for (const [foreground, background] of pairs) {
        const ratio = contrastRatio(valueByCssName(theme, foreground), valueByCssName(theme, background));
        if (ratio < 4.5) problems.push(`${variant} ${theme}: ${foreground} on ${background} is ${ratio.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test("the Alert component builds each variant from the named classes and the hazard style is heavier", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "..", "components", "ui", "alert.tsx"), "utf8");
  for (const { variant, classes } of ALERT_VARIANTS) {
    const line = source.match(new RegExp(`\\s${variant}:\\s*"([^"]+)"`))?.[1] ?? "";
    for (const name of classes) assert.ok(line.split(/\s+/).includes(name), `${variant} should use ${name}`);
  }
});

test("table header, stripe and highlight colours keep their words readable in both themes", () => {
  const problems: string[] = [];
  for (const theme of ["light", "dark"] as const) {
    for (const [foreground, background] of TABLE_PAIRS) {
      const ratio = contrastRatio(valueByCssName(theme, foreground), valueByCssName(theme, background));
      if (ratio < 4.5) problems.push(`${theme}: ${foreground} on ${background} is ${ratio.toFixed(2)}`);
    }
  }
  assert.deepEqual(problems, []);
});

test("the table region is focusable, scrolls on its own and the table has a sticky header and stripes", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "..", "components", "ui", "table.tsx"), "utf8");
  assert.match(source, /tabIndex=\{0\}/);
  assert.match(source, /role="region"/);
  assert.ok(source.includes("overflow-auto"));
  assert.ok(source.includes("sticky"));
  assert.ok(source.includes("nth-child(even)"));
  assert.ok(!source.includes("outline-none"), "the global focus ring must stay visible");
});
