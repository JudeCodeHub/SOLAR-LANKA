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
