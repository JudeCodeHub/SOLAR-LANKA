import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`the company home shows next steps and four work cards that each lead to their queue at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-company-home-sample]");
      await sample.scrollIntoViewIfNeeded();
      const steps = sample.locator("[data-next-steps] a");
      await expect(steps).toHaveCount(2);
      for (const step of await steps.all()) expect((await step.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      const cards = sample.locator("[data-card]");
      await expect(cards).toHaveCount(4);
      const expected = [
        ["/company/profile", "Company profile"],
        ["/company/inbox", "Request inbox"],
        ["/company/installations", "Installations"],
        ["/company/offers", "Product offers"],
      ] as const;
      for (const [index, [href, label]] of expected.entries()) {
        const card = cards.nth(index);
        const link = card.getByRole("link");
        await expect(link).toHaveCount(1);
        await expect(link).toHaveAttribute("href", href);
        await expect(link).toContainText(label);
        expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
        await expect(card.locator("svg").first()).toBeVisible();
      }
      // The three counted cards show their figure; an empty queue says so next to its zero.
      await expect(cards.nth(1).locator("[data-figure]")).toHaveText("3");
      await expect(cards.nth(1)).toContainText("2 not opened yet");
      await expect(cards.nth(2).locator("[data-figure]")).toHaveText("0");
      await expect(cards.nth(2).locator("[data-empty]")).toBeVisible();
      await expect(cards.nth(3).locator("[data-figure]")).toHaveText("12");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-company-home-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/company-home-${theme}-${width}.png` });
    });
  }
}
