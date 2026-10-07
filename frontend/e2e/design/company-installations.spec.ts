import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`the company's installation cards match the customer's and link to the company pages at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const company = page.locator("[data-company-installations-sample]");
      const customer = page.locator("[data-installations-sample]");
      await company.scrollIntoViewIfNeeded();
      const cards = company.locator("[data-installation]");
      await expect(cards).toHaveCount(2);
      await expect(cards.nth(0)).toContainText("3 of 8 steps complete");
      await expect(cards.nth(1)).toContainText("7 of 8 steps complete");
      await expect(cards.nth(0).locator("[data-segment='done']")).toHaveCount(3);
      await expect(cards.nth(0).locator("[data-segment='next']")).toHaveCount(1);
      // The link goes to the company's own installation page, with the company in the address.
      for (const [index, id] of ["i2", "i3"].entries()) {
        const link = cards.nth(index).getByRole("link");
        await expect(link).toHaveAttribute("href", `/company/installations/${id}?company=c1`);
        await expect(link).toContainText("Installation started");
        expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      // Same look as the customer's card: the same chip, track and card styling.
      const look = (root: typeof company) => root.locator("[data-installation]").first().evaluate((element) => `${getComputedStyle(element).borderRadius}|${getComputedStyle(element).padding}`);
      expect(await look(company)).toBe(await look(customer));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-company-installations-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });
  }
}
