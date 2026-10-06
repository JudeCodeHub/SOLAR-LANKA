import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`the offer comparison marks differences and what is not specified and ranks nothing at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-compare-sample]");
      await sample.scrollIntoViewIfNeeded();
      const table = sample.locator("[data-compare]");
      await expect(table).toBeVisible();
      await expect(table.locator("[data-offer-column]")).toHaveCount(3);
      for (const name of ["Sunbird Solar", "Ceylon Roofs", "Lanka Watts"]) await expect(table.getByRole("link", { name })).toBeVisible();
      for (const link of await table.locator("[data-offer-column] a").all()) expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      // The total row differs and one offer does not say; both marks are words, not only colour.
      const total = table.locator("[data-row='total']");
      await expect(total).toHaveAttribute("data-differs", "true");
      await expect(total).toHaveAttribute("data-some-unspecified", "true");
      await expect(total.locator("th")).toContainText("Differs");
      await expect(total.locator("td").nth(2)).toContainText("Not specified");
      // A row where every offer says the same thing carries no difference mark.
      const same = table.locator("[data-row='sent']");
      await expect(same).toHaveAttribute("data-differs", "false");
      await expect(same.locator("th")).not.toContainText("Differs");
      // Included and excluded cells are written out.
      await expect(table.locator("[data-row='permits'] [data-cell='included']")).toHaveCount(1);
      await expect(table.locator("[data-row='permits'] [data-cell='excluded']")).toHaveCount(1);
      // Nothing is ranked: no "best", "cheapest" or "recommended" anywhere in the comparison.
      await expect(sample).not.toContainText(/best|cheapest|recommended|winner|rank/i);
      // The scrollable region is labelled and focusable; the page itself does not scroll sideways.
      const region = sample.locator("[data-slot=table-region]");
      await expect(region).toHaveAttribute("tabindex", "0");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-compare-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/compare-${theme}-${width}.png` });
    });
  }
}
