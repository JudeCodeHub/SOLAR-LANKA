import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`the totals panel says it is calculated by the server, has no field and warns when the form has unsaved changes at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-totals-sample]");
      await sample.scrollIntoViewIfNeeded();
      const panels = sample.locator("[data-totals]");
      await expect(panels).toHaveCount(3);
      for (const panel of await panels.all()) {
        // The mark is always there, in words and with an icon, and nothing in the panel can be typed into.
        await expect(panel.locator("[data-badge='server']")).toHaveText("Calculated by the server");
        await expect(panel.locator("[data-badge='server'] svg")).toHaveCount(1);
        await expect(panel.locator("input, textarea, select")).toHaveCount(0);
        expect(await panel.evaluate((element) => parseFloat(getComputedStyle(element).borderTopWidth))).toBeGreaterThanOrEqual(2);
      }
      // Before saving: says so and shows no amounts.
      await expect(panels.nth(0).locator("[data-no-totals]")).toHaveText("Totals appear after you save the draft.");
      await expect(panels.nth(0).locator("[data-total]")).toHaveCount(0);
      // After saving: four amounts, the total emphasised, formatted as money.
      await expect(panels.nth(1).locator("[data-total]")).toHaveCount(4);
      await expect(panels.nth(1).locator("[data-total='Total']")).toContainText("1,600,000");
      await expect(panels.nth(1).locator("[data-total='Discount']")).toContainText("40,000");
      await expect(panels.nth(1).locator("[data-totals-stale]")).toHaveCount(0);
      // With unsaved changes: the same amounts and a warning that they are out of date.
      await expect(panels.nth(2).locator("[data-totals-stale]")).toContainText("Save to update them.");
      await expect(panels.nth(2).locator("[data-total='Total']")).toContainText("1,600,000");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-totals-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/totals-${theme}-${width}.png` });
    });
  }
}
