import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`site visits show their status, the confirmed time and the time zone, and the time fields check themselves at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-visits-sample]");
      await sample.scrollIntoViewIfNeeded();
      const visits = sample.locator("[data-visit]");
      await expect(visits).toHaveCount(4);
      const words = ["Waiting for the company", "The company offered other times", "Confirmed", "Cancelled"];
      for (const [index, word] of words.entries()) {
        await expect(visits.nth(index).locator("[data-visit-status]")).toHaveText(word);
        await expect(visits.nth(index).locator("[data-visit-status] svg")).toHaveCount(1);
      }
      // The confirmed one shows its time in Sri Lanka time, in a highlighted line; the others do not.
      await expect(visits.nth(2).locator("[data-confirmed]")).toContainText("14 October 2026");
      await expect(visits.nth(2).locator("[data-confirmed]")).toContainText("10:00 to 12:00");
      await expect(sample.locator("[data-confirmed]")).toHaveCount(1);
      // A waiting request lists the times that were asked for.
      await expect(visits.nth(0).locator("li")).toHaveCount(2);
      // The time zone is always stated next to the fields.
      await expect(sample.locator("[data-zone-note]")).toContainText("Sri Lanka time (Asia/Colombo)");
      // Every field and button is at least 44 px, and an empty submit shows each error beside its field, in words.
      for (const control of await sample.locator("input, button").all()) {
        if (await control.isVisible()) expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(43.5);
      }
      await sample.locator("[data-demo-submit]").click();
      await expect(sample.locator("[data-error]").first()).toBeVisible();
      expect(await sample.locator("[data-error]").count()).toBeGreaterThanOrEqual(1);
      await expect(sample.locator("[data-error] svg").first()).toBeVisible();
      await expect(sample.locator("input[aria-invalid='true']").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-visits-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/visits-${theme}-${width}.png` });
    });
  }
}
