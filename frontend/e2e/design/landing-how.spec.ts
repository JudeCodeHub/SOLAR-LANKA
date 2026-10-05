import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const RULES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const transformOf = (page: Page, selector: string, index = 0) =>
  page.evaluate(([query, at]) => getComputedStyle(document.querySelectorAll(query as string)[at as number]!).transform, [selector, index]);

test("the line draws as the strip scrolls into view, once, left to right", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto("/");
  const line = '[data-draw-line="x"]';
  await page.locator(line).first().waitFor({ state: "attached" });
  // Waiting off screen, drawn to nothing.
  expect(await transformOf(page, line)).toBe("matrix(0, 0, 0, 1, 0, 0)");
  await page.locator("[data-how-it-works]").scrollIntoViewIfNeeded();
  await expect.poll(() => transformOf(page, line), { timeout: 5000 }).not.toBe("matrix(0, 0, 0, 1, 0, 0)");
  await expect.poll(() => transformOf(page, line), { timeout: 5000 }).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  // It stays drawn when scrolled away and back.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  expect(await transformOf(page, line)).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  // The segments follow one another: the last one is drawn after the first.
  await expect.poll(() => transformOf(page, line, 2), { timeout: 5000 }).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
});

test("with reduced motion the line is already drawn", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto("/");
  await page.locator('[data-draw-line="x"]').first().waitFor({ state: "attached" });
  for (const index of [0, 1, 2]) expect(await transformOf(page, '[data-draw-line="x"]', index)).toBe("none");
});

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 768, 1280]) {
    test(`the strip lists four steps, fits at ${width} px and passes axe in the ${theme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      const strip = page.locator("[data-how-it-works]");
      await strip.scrollIntoViewIfNeeded();
      await expect(strip.getByRole("listitem")).toHaveCount(4);
      for (const title of ["Estimate", "Compare", "Choose", "Track"]) await expect(strip.getByRole("heading", { level: 3, name: title })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-how-it-works]").withTags(RULES).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await strip.screenshot({ path: `e2e/.tmp/how-${theme}-${width}.png` });
    });
  }
}
