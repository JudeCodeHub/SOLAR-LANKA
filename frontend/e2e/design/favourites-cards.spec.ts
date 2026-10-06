import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`saved products use the product card with its figures, heart, compare box and a link back to the favourites at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-favourites-sample]");
      await sample.scrollIntoViewIfNeeded();
      const cards = sample.locator("[data-product]");
      await expect(cards).toHaveCount(3);
      // The same card as the catalogue: photo, kind, one link, two figures, sample label.
      for (const card of await cards.all()) {
        await expect(card.locator("img")).toBeVisible();
        await expect(card.locator("dl dd")).toHaveCount(2);
        await expect(card.getByRole("link").first()).toBeVisible();
        await expect(card).toContainText("Sample");
      }
      await expect(cards.nth(0).getByRole("heading", { level: 3 })).toHaveText("Trina TSM-545");
      await expect(cards.nth(0)).toContainText("545 W");
      // A missing figure says so instead of showing zero.
      await expect(cards.nth(1)).toContainText("Not specified");
      await expect(cards.nth(2)).toContainText("5 kW");
      // The product link leads back to the favourites list.
      const link = cards.nth(0).getByRole("heading", { level: 3 }).getByRole("link");
      expect(await link.getAttribute("href")).toContain("/panels/");
      expect(decodeURIComponent((await link.getAttribute("href")) ?? "")).toContain("/my/favourites");
      // Heart and compare controls are easy to press.
      const compare = cards.nth(0).getByRole("checkbox");
      expect((await compare.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(24);
      for (const control of await cards.nth(0).locator("button, a[href*='sign-in']").all()) expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(43.5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-favourites-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/favourites-${theme}-${width}.png` });
    });
  }
}
