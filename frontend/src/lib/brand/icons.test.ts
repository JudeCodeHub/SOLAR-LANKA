import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { markSmallSvg } from "./logo.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const bytes = (path: string) => readFileSync(join(ROOT, path));
const pngSize = (file: Buffer) => [file.readUInt32BE(16), file.readUInt32BE(20)];

test("the SVG favicon is the small mark", () => {
  assert.equal(bytes("src/app/icon.svg").toString("utf8"), markSmallSvg("Solar Lanka"));
});

test("the app icons are PNGs of the sizes they claim", () => {
  assert.deepEqual(pngSize(bytes("src/app/apple-icon.png")), [180, 180]);
  assert.deepEqual(pngSize(bytes("public/icons/icon-192.png")), [192, 192]);
  assert.deepEqual(pngSize(bytes("public/icons/icon-512.png")), [512, 512]);
  assert.deepEqual(pngSize(bytes("public/icons/icon-maskable-512.png")), [512, 512]);
});

test("favicon.ico holds a 16 px and a 32 px image", () => {
  const ico = bytes("src/app/favicon.ico");
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 2);
  assert.deepEqual([ico.readUInt8(6), ico.readUInt8(22)], [16, 32]);
});

test("the manifest names the icons that exist, and the layout sets a theme colour for both themes", () => {
  const manifest = readFileSync(join(ROOT, "src", "app", "manifest.ts"), "utf8");
  for (const src of manifest.match(/\/icons\/[\w-]+\.png/g) ?? []) assert.ok(bytes(`public${src}`).length > 0, src);
  assert.ok(manifest.includes('purpose: "maskable"'));
  const layout = readFileSync(join(ROOT, "src", "app", "layout.tsx"), "utf8");
  assert.ok(layout.includes("prefers-color-scheme: light") && layout.includes("prefers-color-scheme: dark"));
});
