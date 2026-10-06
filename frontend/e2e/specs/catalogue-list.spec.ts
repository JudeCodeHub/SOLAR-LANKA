import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures.ts";

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 768, 1280]) {
    test(`the panels list fits at ${width} px, filters work and chips remove them (${theme})`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/panels");
      const list = page.locator('[data-catalogue-list="panel"]');
      await expect(list.getByRole("heading", { level: 1, name: "Solar panels" })).toBeVisible();
      await expect(list.getByRole("search")).toBeVisible();
      const cards = list.locator("ul.grid > li");
      const before = await cards.count();
      expect(before).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      // Apply a filter: the address, the results and the chip all agree.
      await list.getByLabel("Minimum power (W)").fill("420");
      await list.getByRole("button", { name: "Apply filters" }).click();
      await expect(page).toHaveURL(/min_w=420/);
      const chip = page.locator("[data-active-filters] a");
      await expect(chip).toHaveCount(1);
      await expect(chip).toContainText("420");
      const watts = await page.locator("ul.grid > li dd").allTextContents();
      for (const text of watts.filter((value) => /\d+ ?W$/.test(value.trim()))) expect(parseFloat(text)).toBeGreaterThanOrEqual(420);
      await expect(chip).toBeVisible();
      expect(await chip.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);

      // Removing the chip drops the filter again.
      await chip.click();
      await expect(page).toHaveURL(/\/panels$/);
      await expect(page.locator("[data-active-filters]")).toHaveCount(0);

      const { violations } = await new AxeBuilder({ page }).include("[data-catalogue-list]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await page.screenshot({ path: `e2e/.tmp/panels-${theme}-${width}.png`, fullPage: true });
    });
  }
}
