import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 1280]) {
    test(`the comparison table shows two sample offers and a warming gap column at ${width} px in the ${theme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const section = page.locator("[data-comparison-section]");
      await section.scrollIntoViewIfNeeded();
      const region = section.getByRole("region", { name: "Sample quotation comparison" });
      await expect(region).toBeVisible();
      const table = region.getByRole("table", { name: "Two sample offers compared for five system sizes" });
      await expect(table.getByRole("columnheader")).toHaveCount(4);
      await expect(table.getByRole("row")).toHaveCount(6);
      await expect(table.getByRole("rowheader")).toHaveCount(5);
      await expect(table.getByRole("row").nth(1)).toContainText("LKR 60,000");
      await expect(table.getByRole("row").nth(5)).toContainText("LKR 680,000");
      // The gap column warms up down the table: each tint is stronger than the one above.
      const alphas = await table.locator("[data-gap]").evaluateAll((cells) => cells.map((cell) => getComputedStyle(cell).backgroundColor).map((colour) => Number(/\/ ([\d.]+)\)|rgba\([^)]*,\s*([\d.]+)\)/.exec(colour)?.slice(1).find(Boolean) ?? 1)));
      for (let index = 1; index < alphas.length; index += 1) expect(alphas[index]!).toBeGreaterThan(alphas[index - 1]!);
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
