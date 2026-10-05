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

test("the skeleton shimmer animates softly and is switched off under reduced motion", () => {
  const css = readFileSync(join(import.meta.dirname, "..", "..", "app", "globals.css"), "utf8");
  const block = css.slice(css.indexOf("@utility shimmer"));
  assert.match(block, /animation: shimmer-sweep 1\.6s/);
  assert.match(block.slice(block.indexOf("prefers-reduced-motion")), /animation: none/);
  const source = readFileSync(join(import.meta.dirname, "..", "..", "components", "ui", "skeleton.tsx"), "utf8");
  assert.ok(source.includes("shimmer") && !source.includes("animate-pulse"), "the old pulse ignores reduced motion");
});

test("the page transition is a short fade, off under reduced motion, and wraps only the page content", () => {
  const layout = readFileSync(join(import.meta.dirname, "..", "..", "app", "layout.tsx"), "utf8");
  assert.match(layout, /<ViewTransition default="page">\{children\}<\/ViewTransition>/);
  assert.ok(layout.indexOf("<ViewTransition") > layout.indexOf("<main"), "the header and footer stay put");
  const block = css.slice(css.indexOf("Page transition:"));
  assert.match(block, /::view-transition-old\(\.page\)[\s\S]*120ms/);
  assert.match(block, /::view-transition-new\(\.page\)[\s\S]*220ms/);
  assert.match(block.slice(block.indexOf("prefers-reduced-motion")), /animation: none !important/);
});

test("the hero entrance rises in turn, fades the photo, delays the dial sweep, and is skipped under reduced motion", () => {
  const block = css.slice(css.indexOf("Hero entrance:"));
  assert.match(block, /@utility hero-in \{[\s\S]*animation: hero-rise 640ms[\s\S]*calc\(var\(--i, 0\) \* 90ms\)/);
  assert.match(block, /@utility hero-fade \{[\s\S]*animation: hero-fade 900ms/);
  const reduced = [...block.matchAll(/prefers-reduced-motion: reduce\) \{\s*animation: none;/g)];
  assert.equal(reduced.length, 2, "both entrance utilities switch off under reduced motion");
  assert.match(css, /animation: dial-sweep var\(--ds-dur-sweep\) var\(--ds-ease\) var\(--dial-delay, 0ms\) both/);
  const hero = readFileSync(join(import.meta.dirname, "..", "..", "components", "landing", "hero.tsx"), "utf8");
  for (const index of [0, 1, 2, 3, 4, 5]) assert.ok(hero.includes(`step(${index})`), `step ${index}`);
  assert.ok(hero.includes("hero-fade") && hero.includes("delay={900}"));
});
