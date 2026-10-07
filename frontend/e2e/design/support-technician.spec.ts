import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`a technician's support list puts dangerous cases first as red cards with big links at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const list = page.locator("[data-technician-cases]");
      await list.scrollIntoViewIfNeeded();
      const cases = list.locator("[data-case]");
      await expect(cases).toHaveCount(3);
      // The input order was open, resolved, dangerous; the dangerous one comes first and is the only red card.
      await expect(cases.nth(0)).toHaveAttribute("data-unsafe", "true");
      await expect(cases.nth(0).locator("[data-unsafe-chip]")).toHaveText("May be dangerous");
      expect(await cases.nth(0).evaluate((element) => parseFloat(getComputedStyle(element).borderTopWidth))).toBeGreaterThanOrEqual(2);
      await expect(cases.nth(1)).toHaveAttribute("data-unsafe", "false");
      await expect(cases.nth(2)).toHaveAttribute("data-unsafe", "false");
      // The others keep their order (open, then resolved), links go to the technician's own pages at 44 px.
      await expect(cases.nth(1).locator("[data-case-status]")).toHaveText("Open");
      await expect(cases.nth(2).locator("[data-case-status]")).toHaveText("Resolved");
      for (const card of await cases.all()) {
        const link = card.getByRole("link");
        expect(await link.getAttribute("href")).toMatch(/^\/technician\/support\/s\d$/);
        expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-technician-cases]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });
  }
}
