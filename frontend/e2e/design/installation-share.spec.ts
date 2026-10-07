import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`shared updates are marked as customer-visible, and the form checks itself before anything is sent at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-share-sample]");
      await sample.scrollIntoViewIfNeeded();
      // What the customer sees now: the schedule when there is one, "nothing shared" when there is not.
      const shown = sample.locator("[data-shared-now]");
      await expect(shown).toHaveCount(2);
      await expect(shown.nth(0)).toContainText("Next action: Confirm a delivery day");
      await expect(shown.nth(0)).toContainText("12 October 2026");
      await expect(shown.nth(1)).toContainText("Nothing");
      // The form is marked as visible to the customer, in words and with an icon.
      const form = sample.locator("[data-share-form]");
      await expect(form.locator("[data-badge='shared']")).toBeVisible();
      await expect(form.locator("[data-badge='shared'] svg")).toHaveCount(1);
      expect(await form.evaluate((element) => parseFloat(getComputedStyle(element).borderTopWidth))).toBeGreaterThanOrEqual(2);
      // Fields are at least 44 px; the three are labelled and described.
      for (const label of await form.locator("label").all()) await expect(label).toBeVisible();
      for (const control of await form.locator("input, button").all()) expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(43.5);
      // An empty send is refused here: a red summary takes focus, and each field with a problem is marked.
      await form.locator("[data-action='share']").click();
      const summary = form.locator("[data-error-summary]");
      await expect(summary).toBeVisible();
      await expect(summary).toBeFocused();
      await expect(summary).toHaveAttribute("role", "alert");
      expect(await summary.evaluate((element) => parseFloat(getComputedStyle(element).borderTopWidth))).toBeGreaterThanOrEqual(2);
      expect(await form.locator("[aria-invalid='true']").count()).toBeGreaterThanOrEqual(1);
      await expect(form.locator("[data-error] svg").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-share-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/share-${theme}-${width}.png` });
    });
  }
}
