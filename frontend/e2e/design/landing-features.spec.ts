import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const RULES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const LINKS: [string, string, string][] = [
  ["estimate", "Start an estimate", "/estimator"],
  ["compare", "See how comparison works", "/panels"],
  ["track", "See the steps", "#tracking"],
  ["learn", "Open the learning centre", "/learn"],
];

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 768, 1280]) {
    test(`the feature grid shows four linked cards at ${width} px in the ${theme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      const grid = page.locator("[data-feature-grid]");
      await grid.scrollIntoViewIfNeeded();
      for (const [id, label, href] of LINKS) {
        const card = grid.locator(`[data-feature="${id}"]`);
        await expect(card).toBeVisible();
        await expect(card.getByRole("img")).toBeVisible();
        const link = card.getByRole("link", { name: label });
        await expect(link).toHaveAttribute("href", href);
        const box = await link.boundingBox();
        expect(box && box.height >= 44, `${id} link height`).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (width === 1280) {
        // Uneven: the first card is wider than the second, and the third is narrower than the fourth.
        const widths = await grid.locator("[data-feature]").evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().width));
        expect(widths[0]).toBeGreaterThan(widths[1]! * 1.25);
        expect(widths[3]).toBeGreaterThan(widths[2]! * 1.25);
      }
      const { violations } = await new AxeBuilder({ page }).include("[data-feature-grid]").withTags(RULES).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await page.locator("section[aria-labelledby=features-title]").screenshot({ path: `e2e/.tmp/features-${theme}-${width}.png` });
    });
  }
}
