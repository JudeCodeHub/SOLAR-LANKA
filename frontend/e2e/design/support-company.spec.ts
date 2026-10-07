import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`on the company list a dangerous case stands out and comes first, with the company's own link and wording at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const list = page.locator("[data-company-cases]");
      await list.scrollIntoViewIfNeeded();
      const cases = list.locator("[data-case]");
      await expect(cases).toHaveCount(2);
      // The dangerous one is first, red with a thick border and the company's own words ("May be dangerous").
      await expect(cases.nth(0)).toHaveAttribute("data-unsafe", "true");
      await expect(cases.nth(0).locator("[data-unsafe-chip]")).toHaveText("May be dangerous");
      expect(await cases.nth(0).evaluate((element) => parseFloat(getComputedStyle(element).borderTopWidth))).toBeGreaterThanOrEqual(2);
      await expect(cases.nth(1)).toHaveAttribute("data-unsafe", "false");
      await expect(cases.nth(1).locator("[data-unsafe-chip]")).toHaveCount(0);
      const backgrounds = await cases.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor));
      expect(backgrounds[0]).not.toBe(backgrounds[1]);
      // Links go to the company's case page with the company in the address, and are 44 px.
      await expect(cases.nth(0).getByRole("link")).toHaveAttribute("href", "/company/support/s2?company=c1");
      for (const card of await cases.all()) expect((await card.getByRole("link").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-company-cases]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });
  }
}
