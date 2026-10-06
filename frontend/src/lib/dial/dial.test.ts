import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { arcPath, band, DIAL_TICKS, fraction, niceMax, ticks } from "./dial.ts";
import { format, messages } from "../../messages/index.ts";

test("the value covers its share of the range and is held inside it", () => {
  assert.equal(fraction(5, 0, 10), 0.5);
  assert.equal(fraction(0, 0, 10), 0);
  assert.equal(fraction(10, 0, 10), 1);
  assert.equal(fraction(-3, 0, 10), 0);
  assert.equal(fraction(42, 0, 10), 1);
  assert.equal(fraction(72, 0, 100), 0.72);
});

test("a flat range or a value that is not a number draws an empty dial", () => {
  assert.equal(fraction(5, 5, 5), 0);
  assert.equal(fraction(5, 10, 0), 0);
  assert.equal(fraction(Number.NaN, 0, 10), 0);
  assert.equal(fraction(Number.POSITIVE_INFINITY, 0, 10), 0);
});

test("the arc opens at the bottom and the ticks are evenly spaced inside it", () => {
  assert.match(arcPath(), /^M43\.43 156\.57A80 80 0 1 1 156\.57 156\.57$/);
  assert.equal(ticks().length, DIAL_TICKS);
  const first = ticks()[0]!;
  const last = ticks().at(-1)!;
  assert.ok(first.x1 < 100 && last.x1 > 100, "the ticks run from the left to the right");
});

test("the spoken description names the value, the unit and the scale", () => {
  const spoken = format(messages.dial.description, { label: "System size", value: "5.4", unit: "kW", min: 0, max: 15 });
  assert.equal(spoken, "System size: 5.4 kW, on a scale from 0 to 15");
});

test("the dial is one labelled image, sweeps once and holds still under reduced motion", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "..", "components", "ui", "dial.tsx"), "utf8");
  assert.ok(source.includes('role="img"') && source.includes("aria-label"));
  assert.ok(source.includes("dial-sweep"));
  const css = readFileSync(join(import.meta.dirname, "..", "..", "app", "globals.css"), "utf8");
  const block = css.slice(css.indexOf("@utility dial-sweep"));
  assert.match(block, /var\(--ds-dur-sweep\)/);
  assert.match(block.slice(block.indexOf("prefers-reduced-motion")), /animation: none/);
});

test("the loader is a dial that turns, holds still under reduced motion, and the button uses it instead of the old spinner", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const css = read("app/globals.css");
  const block = css.slice(css.indexOf("@utility dial-spin"));
  assert.match(block, /animation: dial-spin/);
  assert.match(block.slice(block.indexOf("prefers-reduced-motion")), /animation: none/);
  assert.ok(read("components/ui/dial-loader.tsx").includes("aria-hidden"));
  assert.ok(read("components/ui/button.tsx").includes("<DialLoader />") && !read("components/ui/button.tsx").includes("Loader2"));
  assert.ok(read("components/states/loading-state.tsx").includes("<DialLoader"));
});

test("niceMax gives a round scale top with room above the value", () => {
  assert.equal(niceMax(5.4), 10);
  assert.equal(niceMax(7), 10);
  assert.equal(niceMax(8.5), 20);
  assert.equal(niceMax(3000), 5000);
  assert.equal(niceMax(7300), 10000);
  assert.equal(niceMax(0), 1);
  assert.equal(niceMax(Number.NaN), 1);
  for (const value of [0.4, 1, 2.2, 13, 480, 9100]) assert.ok(niceMax(value) >= value * 1.25, String(value));
});

test("a band on the dial runs from the lower to the higher value, and a single value still shows as a mark", () => {
  assert.deepEqual(band(2, 4, 0, 10), { start: 20, length: 20 });
  assert.deepEqual(band(4, 2, 0, 10), { start: 20, length: 20 });
  const single = band(5, 5, 0, 10);
  assert.equal(single.start, 50);
  assert.ok(single.length > 0 && single.length < 2, "a thin mark, not nothing");
});
