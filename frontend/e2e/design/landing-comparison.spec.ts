import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 1280]) {
    test(`the comparison table flags differences and says Not specified at ${width} px in the ${theme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const section = page.locator("[data-comparison-section]");
      await section.scrollIntoViewIfNeeded();
      const region = section.getByRole("region", { name: "Sample quotation comparison" });
      await expect(region).toBeVisible();
      const table = region.getByRole("table", { name: "Three sample quotations compared side by side" });
      await expect(table.getByRole("columnheader")).toHaveCount(4);
      await expect(table.getByRole("row")).toHaveCount(7);
      await expect(table.locator('[data-row="size"]')).toHaveAttribute("data-flag", "same");
      await expect(table.locator('[data-row="panels"]')).toHaveAttribute("data-flag", "differs");
      await expect(table.locator('[data-row="battery"]')).toHaveAttribute("data-flag", "unspecified");
      await expect(table.locator('[data-row="battery"] [data-cell="unspecified"]')).toHaveCount(2);
      await expect(table.locator('[data-row="battery"]')).toContainText("Not specified by some offers");
      await expect(table.locator('[data-row="panels"]')).toContainText("Differs between offers");
      await expect(section.getByText("Sample data")).toBeVisible();
      // On a phone the table scrolls inside its own region and the page does not.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (width === 320) expect(await region.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-comparison-section]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await section.screenshot({ path: `e2e/.tmp/comparison-${theme}-${width}.png` });
    });
  }
}
