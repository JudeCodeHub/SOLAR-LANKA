// Writes the logo SVG files into public/brand from the geometry in src/lib/brand/logo.ts.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { lockupSvg, markSmallSvg, markSvg } from "../src/lib/brand/logo.ts";

const TITLE = "Solar Lanka";
const OUT = join(import.meta.dirname, "..", "public", "brand");
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "logo-mark-light.svg"), markSvg("light", TITLE));
writeFileSync(join(OUT, "logo-mark-dark.svg"), markSvg("dark", TITLE));
writeFileSync(join(OUT, "logo-lockup-light.svg"), lockupSvg("light", TITLE));
writeFileSync(join(OUT, "logo-lockup-dark.svg"), lockupSvg("dark", TITLE));
writeFileSync(join(OUT, "logo-mark-small.svg"), markSmallSvg(TITLE));

// App icons: the small mark as the SVG favicon, and PNGs and an .ico drawn from the same geometry.
import { createRequire } from "node:module";

import { BRAND_COLOURS } from "../src/lib/brand/logo.ts";

const sharp = createRequire(createRequire(import.meta.url).resolve("next/package.json"))("sharp");
const APP = join(import.meta.dirname, "..", "src", "app");
const ICONS = join(import.meta.dirname, "..", "public", "icons");
mkdirSync(ICONS, { recursive: true });
writeFileSync(join(APP, "icon.svg"), markSmallSvg(TITLE));

const detailed = Buffer.from(markSvg("light", TITLE));
const background = BRAND_COLOURS.light.background;

/** The detailed mark centred on the ivory background, taking `share` of the side (a maskable icon keeps to the central 60 %). */
async function square(size, share, file) {
  const mark = await sharp(detailed, { density: 600 }).resize(Math.round(size * share)).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 3, background } })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toFile(file);
}
await square(180, 0.78, join(APP, "apple-icon.png"));
await square(192, 0.78, join(ICONS, "icon-192.png"));
await square(512, 0.78, join(ICONS, "icon-512.png"));
await square(512, 0.6, join(ICONS, "icon-maskable-512.png"));

// An .ico can hold PNG images: 16 and 32 px drawn from the small mark on a transparent background.
const small = Buffer.from(markSmallSvg(TITLE));
const pngs = await Promise.all([16, 32].map((size) => sharp(small, { density: 1200 }).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * pngs.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
let offset = header.length;
pngs.forEach((png, index) => {
  const size = [16, 32][index];
  const entry = 6 + 16 * index;
  header.writeUInt8(size, entry);
  header.writeUInt8(size, entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
writeFileSync(join(APP, "favicon.ico"), Buffer.concat([header, ...pngs]));
