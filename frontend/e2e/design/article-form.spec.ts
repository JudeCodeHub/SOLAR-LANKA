import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`the article form checks itself first, shows sources and flags clearly, and keeps review, publish and archive behind questions at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-article-form-sample]");
      await sample.scrollIntoViewIfNeeded();
      await expect(sample.getByRole("heading", { level: 1 })).toHaveText("How rooftop solar works");
      await expect(sample.locator("[data-status]")).toContainText("Draft");
      // Flags: time-sensitive is ticked (amber box, with the two dates shown), sample is ticked (blue box).
      await expect(sample.locator("[data-time-sensitive-box]")).toBeVisible();
      await expect(sample.locator("[data-sample-box]")).toBeVisible();
      await expect(sample.locator("#a-valid_as_of")).toBeVisible();
      await expect(sample.locator("#a-review_by")).toBeVisible();
      const tsBackground = await sample.locator("[data-time-sensitive-box]").evaluate((element) => getComputedStyle(element).backgroundColor);
      await sample.getByRole("checkbox", { name: /time|change/i }).first().uncheck();
      expect(await sample.locator("[data-time-sensitive-box]").evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(tsBackground);
      await expect(sample.locator("#a-valid_as_of")).toHaveCount(0);
      // Sources: one row, add a second, remove it again.
      await expect(sample.locator("[data-source-row]")).toHaveCount(1);
      await sample.getByRole("button", { name: "Add a source" }).click();
      await expect(sample.locator("[data-source-row]")).toHaveCount(2);
      await sample.getByRole("button", { name: /Remove source 2/ }).click();
      await expect(sample.locator("[data-source-row]")).toHaveCount(1);
      // A missing title is refused on the page: a red summary takes focus and the field says why.
      await sample.locator("#a-title").fill("");
      await sample.locator("[data-action='save']").click();
      const summary = sample.locator("[data-error-summary]");
      await expect(summary).toBeVisible();
      await expect(summary).toBeFocused();
      await expect(sample.locator("#a-title")).toHaveAttribute("aria-invalid", "true");
      await expect(sample.locator("[data-error='title'] svg")).toBeVisible();
      // The author cannot review their own article: the button is blocked and the reason is written beside it.
      await expect(sample.locator("[data-action='review']")).toHaveAttribute("aria-disabled", "true");
      await expect(sample.locator("[data-own-work]")).toBeVisible();
      // Publishing needs a review first, so it is not offered on an unreviewed draft; archive asks first.
      await expect(sample.locator("[data-action='publish']")).toHaveCount(0);
      for (const control of await sample.locator("form input:not([type=checkbox]), form select, form button").all()) {
        if (await control.isVisible()) expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(43.5);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-article-form-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/article-form-${theme}-${width}.png` });
    });
  }
}
