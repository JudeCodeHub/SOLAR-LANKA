import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`a product offer keeps price, currency, the sample flag and the claim, and its specifications stay read-only at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-offers-form-sample]");
      await sample.scrollIntoViewIfNeeded();
      // Specifications: read-only, with the lock and the sentence that says so, and no field in them.
      const specs = sample.locator("[data-specs]");
      await expect(specs).toContainText("545");
      await expect(specs.locator("svg")).toHaveCount(1);
      await expect(specs.locator("input, textarea, select")).toHaveCount(0);
      // The preview: a priced sample offer carries the sample badge; an unpriced one says there is no price.
      const previews = sample.locator("[data-preview]");
      await expect(previews).toHaveCount(2);
      await expect(previews.nth(0).locator("[data-sample-price]")).toBeVisible();
      await expect(previews.nth(0)).toContainText("95,000");
      await expect(previews.nth(0)).toContainText("Ten-year product warranty");
      await expect(previews.nth(1).locator("[data-no-price]")).toBeVisible();
      await expect(previews.nth(1).locator("[data-sample-price]")).toHaveCount(0);
      // The form: price, currency, the sample flag and the claim, each labelled, fields at least 44 px.
      const form = sample.locator("form");
      for (const label of ["Indicative price", "Currency", "Your claim"]) await expect(form.getByLabel(label)).toBeVisible();
      const flag = form.getByRole("checkbox", { name: "This is a sample price" });
      await expect(flag).not.toBeChecked();
      expect((await form.locator("label").filter({ hasText: "This is a sample price" }).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      const box = () => flag.evaluate((element) => getComputedStyle(element.closest("div") as Element).backgroundColor);
      const before = await box();
      await flag.check();
      // Ticking the sample flag tints its box, so the state is not carried by the tick alone.
      expect(await box()).not.toBe(before);
      for (const control of await form.locator("input:not([type=checkbox]), textarea, button").all()) {
        if (await control.isVisible()) expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(43.5);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-offers-form-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/offers-form-${theme}-${width}.png` });
    });
  }
}
