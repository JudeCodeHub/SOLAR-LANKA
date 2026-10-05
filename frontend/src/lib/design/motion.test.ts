import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const css = readFileSync(join(import.meta.dirname, "..", "..", "app", "globals.css"), "utf8");
const utility = (name: string) => css.match(new RegExp(`@utility ${name} \\{([\\s\\S]*?)\\n\\}\\n`))?.[1] ?? "";

test("the motion tokens exist", () => {
  for (const token of ["--ds-dur-fast: 120ms", "--ds-dur-base: 240ms", "--ds-dur-reveal: 480ms", "--ds-dur-sweep: 1200ms", "--ds-ease: cubic-bezier"]) assert.ok(css.includes(token), token);
});

test("reveal hides content only when scripting is on, and does nothing under reduced motion", () => {
  const reveal = utility("reveal");
  assert.match(reveal, /@media \(scripting: enabled\)/);
  assert.match(reveal, /@media \(prefers-reduced-motion: reduce\)/);
  // Under reduced motion the hidden state is replaced by a visible one and the transition is removed.
  const reduced = reveal.slice(reveal.indexOf("prefers-reduced-motion"));
  assert.match(reduced, /transition: none/);
  assert.match(reduced, /opacity: 1/);
});

test("the grain never takes clicks and sits behind the content", () => {
  const grain = utility("grain");
  assert.match(grain, /pointer-events: none/);
  assert.match(grain, /z-index: -1/);
});

test("both themes define the three elevation levels and the grain strength", () => {
  const light = css.slice(css.indexOf(":root,"), css.indexOf(".dark {"));
  const dark = css.slice(css.indexOf(".dark {"), css.indexOf("@layer base"));
  for (const block of [light, dark]) for (const token of ["--ds-shadow-1", "--ds-shadow-2", "--ds-shadow-3", "--ds-grain-opacity"]) assert.ok(block.includes(token), token);
});

test("the container, section and radius tokens are in the theme", () => {
  for (const token of ["--container-content: 75rem", "--container-wide: 90rem", "--container-reading: 45rem", "--spacing-section-s", "--spacing-section-xl", "--radius-field", "--radius-card", "--radius-panel"]) assert.ok(css.includes(token), token);
});
