import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`the product form keeps its checks, refuses a bad figure before sending and keeps archiving behind a question at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-product-form-sample]");
      await sample.scrollIntoViewIfNeeded();
      await expect(sample.getByRole("heading", { level: 1 })).toHaveText("Edit Trina TSM-545");
      // Names and specifications are two cards; every field is labelled and at least 44 px tall.
      await expect(sample.locator("[data-section='names']")).toBeVisible();
      await expect(sample.locator("[data-section='specs']")).toBeVisible();
      for (const control of await sample.locator("form input, form select, form button").all()) expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(43.5);
      await expect(sample.locator("#f-wattage_w")).toHaveValue("545");
      // A bad figure is refused on the page: a red summary takes focus, the field is marked and says why, nothing is sent.
      await sample.locator("#f-wattage_w").fill("abc");
      await sample.locator("[data-action='save']").click();
      const summary = sample.locator("[data-error-summary]");
      await expect(summary).toBeVisible();
      await expect(summary).toBeFocused();
      await expect(summary).toHaveAttribute("role", "alert");
      expect(await summary.evaluate((element) => parseFloat(getComputedStyle(element).borderTopWidth))).toBeGreaterThanOrEqual(2);
      await expect(sample.locator("#f-wattage_w")).toHaveAttribute("aria-invalid", "true");
      await expect(sample.locator("[data-error='wattage_w'] svg")).toBeVisible();
      // Nothing changed: the form says so and sends nothing.
      await sample.locator("#f-wattage_w").fill("545");
      await sample.locator("[data-action='save']").click();
      await expect(sample.locator("[data-notice]")).toBeVisible();
      // Archiving is behind a question that names the product.
      await sample.locator("[data-action='archive']").click();
      const question = sample.locator("[data-confirm='archive']");
      await expect(question).toContainText("Trina TSM-545");
      await expect(question.getByRole("heading")).toBeFocused();
      await question.getByRole("button", { name: /Keep|Not yet/ }).first().click();
      await expect(question).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-product-form-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/product-form-${theme}-${width}.png` });
    });
  }
}
