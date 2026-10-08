import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const RULES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const LINKS: [string, string, string][] = [
  ["estimate", "Start an estimate", "/estimator"],
  ["compare", "See a comparison", "#compare"],
  ["track", "Create an account to follow yours", "/sign-up"],
  ["learn", "Open the learning centre", "/learn"],
  ["companies", "See all companies", "/companies"],
  ["safety", "Read the safety guidance", "/support"],
];

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 768, 1280]) {
    test(`the feature grid shows six linked cards at ${width} px in the ${theme} theme`, async ({ page }) => {
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
        // Even: three equal cards across, two rows.
        const widths = await grid.locator("[data-feature]").evaluateAll((cards) => cards.map((card) => Math.round(card.getBoundingClientRect().width)));
        expect(new Set(widths).size).toBe(1);
      }
      const { violations } = await new AxeBuilder({ page }).include("[data-feature-grid]").withTags(RULES).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await page.locator("section[aria-labelledby=features-title]").screenshot({ path: `e2e/.tmp/features-${theme}-${width}.png` });
    });
  }
}
