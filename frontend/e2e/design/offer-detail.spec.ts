import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`the offer page shows its state, total, items, terms, inclusions and earlier revision exactly at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-offer-sample]");
      await sample.scrollIntoViewIfNeeded();
      const header = sample.locator("[data-offer-header]");
      await expect(header.getByRole("heading", { level: 1 })).toHaveText("Offer from Sunbird Solar");
      await expect(header.locator("[data-state]")).toHaveAttribute("data-state", "active");
      await expect(header.locator("[data-state] svg")).toHaveCount(1);
      await expect(header).toContainText("Revision 2");
      await expect(header.locator("[data-headline-total]")).toContainText("1,600,000");
      await expect(header.locator("[data-expiry]")).toContainText("8 October 2026");
      await expect(header.locator("[data-soon]")).toBeVisible();
      // The itemised table and the totals match the stored values.
      const lines = sample.locator("[data-lines] tbody tr");
      await expect(lines).toHaveCount(3);
      await expect(lines.nth(0)).toContainText("Solar panels (Trina TSM-545)");
      await expect(lines.nth(0)).toContainText("950,000");
      const totals = sample.locator("[data-totals]");
      for (const value of ["1,640,000", "40,000", "1,600,000"]) await expect(totals).toContainText(value);
      // Terms and inclusions: what is missing says so, in words.
      await expect(sample.locator("[data-terms]")).toContainText("10 years on panels");
      await expect(sample.locator("[data-terms] [data-unspecified]")).toHaveCount(1);
      await expect(sample.locator("[data-inclusion='included']")).toHaveCount(2);
      await expect(sample.locator("[data-inclusion='not_specified']")).toHaveCount(5);
      await expect(sample.locator("[data-inclusion='not_specified']").first()).toContainText("Not specified");
      // The earlier revision is folded away and opens from the keyboard.
      const earlier = sample.locator("[data-earlier-revision='1']");
      await expect(earlier).toHaveJSProperty("open", false);
      await expect(earlier.locator("summary")).toContainText("Revision 1");
      expect((await earlier.locator("summary").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      await earlier.locator("summary").focus();
      await page.keyboard.press("Enter");
      await expect(earlier).toHaveJSProperty("open", true);
      await expect(earlier).toContainText("1,640,000");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-offer-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/offer-${theme}-${width}.png` });
    });
  }
}
