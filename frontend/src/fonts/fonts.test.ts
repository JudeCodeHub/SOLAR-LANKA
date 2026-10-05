import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..", "..");
const fonts = join(import.meta.dirname);

const FILES: Record<string, string[]> = {
  fraunces: ["fraunces-latin-opsz-normal.woff2", "fraunces-latin-opsz-italic.woff2"],
  "hanken-grotesk": ["hanken-grotesk-latin-wght-normal.woff2"],
  "ibm-plex-mono": ["ibm-plex-mono-latin-400-normal.woff2", "ibm-plex-mono-latin-500-normal.woff2", "ibm-plex-mono-latin-600-normal.woff2"],
};

function sources(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sources(path) : /\.(ts|tsx|css)$/.test(name) ? [path] : [];
  });
}

test("every font file the loader names is in the project, with its licence beside it", () => {
  for (const [family, files] of Object.entries(FILES)) {
    for (const file of files) assert.ok(existsSync(join(fonts, family, file)), `${family}/${file}`);
    assert.match(readFileSync(join(fonts, family, "OFL.txt"), "utf8"), /SIL OPEN FONT LICENSE Version 1\.1/i, family);
  }
  assert.match(readFileSync(join(fonts, "NOTICE.txt"), "utf8"), /SIL Open Font License/);
});

test("the loader file refers to exactly those files", () => {
  const loader = readFileSync(join(fonts, "fonts.ts"), "utf8");
  for (const [family, files] of Object.entries(FILES)) {
    for (const file of files) assert.ok(loader.includes(`./${family}/${file}`), file);
  }
});

test("nothing fetches fonts from the network, so a build works offline", () => {
  for (const file of sources(join(root, "src"))) {
    if (file.endsWith("fonts.test.ts")) continue;
    const text = readFileSync(file, "utf8");
    assert.ok(!text.includes("next/font/google"), file);
    assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(text), file);
  }
});
