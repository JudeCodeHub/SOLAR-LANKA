import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { contrastRatio } from "../design/contrast.ts";
import { ARC_PATH, BRAND_COLOURS, DETAIL_MIN_SIZE, LOCKUP, lockupSvg, markSmallSvg, markSvg, RAYS, TICKS, WORDMARK_PATH } from "./logo.ts";

const FILES = join(import.meta.dirname, "..", "..", "..", "public", "brand");
const read = (name: string) => readFileSync(join(FILES, name), "utf8");

test("the SVG files in public/brand match the geometry (run pnpm brand after changing it)", () => {
  assert.equal(read("logo-mark-light.svg"), markSvg("light", "Solar Lanka"));
  assert.equal(read("logo-mark-dark.svg"), markSvg("dark", "Solar Lanka"));
  assert.equal(read("logo-lockup-light.svg"), lockupSvg("light", "Solar Lanka"));
  assert.equal(read("logo-lockup-dark.svg"), lockupSvg("dark", "Solar Lanka"));
  assert.equal(read("logo-mark-small.svg"), markSmallSvg("Solar Lanka"));
});

test("the mark is a 270 degree arc with eleven ticks and eight rays, and the small version drops the detail", () => {
  assert.match(ARC_PATH, /A27 27 0 1 1/);
  assert.equal(TICKS.length, 11);
  assert.equal(RAYS.length, 8);
  assert.ok(DETAIL_MIN_SIZE > 16 && DETAIL_MIN_SIZE <= 32);
  assert.ok(!markSmallSvg("x").includes("<line"));
});

test("the wordmark is outlined, so it needs no font, and fits inside the lockup", () => {
  assert.ok(WORDMARK_PATH.startsWith("M") && !lockupSvg("light", "x").includes("<text"));
  assert.ok(LOCKUP.width > 200 && LOCKUP.height === 64);
});

test("the wordmark and the dial ticks are readable on both theme backgrounds", () => {
  for (const theme of ["light", "dark"] as const) {
    const { ink, tick, background } = BRAND_COLOURS[theme];
    assert.ok(contrastRatio(ink, background) >= 4.5, `${theme} wordmark`);
    assert.ok(contrastRatio(tick, background) >= 3, `${theme} ticks`);
  }
});

test("the React logo is labelled for assistive technology and the mark alone is decorative by default", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "..", "components", "brand", "logo.tsx"), "utf8");
  assert.ok(source.includes('role="img"') && source.includes("aria-label={messages.app.name}"));
  assert.ok(source.includes('"aria-hidden": true'));
  assert.ok(source.includes('fill="currentColor"'));
});
