import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 768, 1280]) {
    test(`quotation lines add and remove as before, show the server's line total and have big fields at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-lines-sample]");
      await sample.scrollIntoViewIfNeeded();
      const lines = sample.locator("[data-line]");
      await expect(lines).toHaveCount(2);
      await expect(lines.nth(0).locator("legend")).toHaveText("Line 1");
      // The line total is the server's, shown as text, never as a field; the unsaved line says it is pending.
      await expect(lines.nth(0).locator("[data-line-total]")).toContainText("270,000");
      await expect(lines.nth(1).locator("[data-line-total]")).toHaveText("The line total appears after you save.");
      await expect(lines.nth(0).locator("input[name*='total']")).toHaveCount(0);
      // Every field and button is at least 44 px tall.
      for (const control of await sample.locator("input:not([type=hidden]), select, textarea, button").all()) {
        if (await control.isVisible()) expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(43.5);
      }
      // Add a line: a third row appears, blank equipment with a product chooser; the add button is still there.
      await sample.locator("[data-add-line]").click();
      await expect(lines).toHaveCount(3);
      await expect(lines.nth(2).locator("[data-product]")).toBeVisible();
      await expect(lines.nth(2).getByRole("button", { name: "Choose a product" })).toBeVisible();
      // Remove the first: two remain, in the same order, and the numbering follows.
      await sample.getByRole("button", { name: "Remove line 1" }).click();
      await expect(lines).toHaveCount(2);
      await expect(lines.nth(0).locator("input[name='lines.0.description']")).toHaveValue("Delivery");
      await expect(lines.nth(0).locator("legend")).toHaveText("Line 1");
      // With one line left there is nothing to remove.
      await sample.getByRole("button", { name: "Remove line 1" }).click();
      await expect(lines).toHaveCount(1);
      await expect(sample.getByRole("button", { name: /^Remove line/ })).toHaveCount(0);
      // Changing a line to a charge hides the product chooser.
      await lines.nth(0).getByLabel("Type").selectOption("charge");
      await expect(lines.nth(0).locator("[data-product]")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-lines-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/lines-${theme}-${width}.png` });
    });
  }
}
