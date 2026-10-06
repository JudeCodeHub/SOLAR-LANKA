import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`a support case shows its shared updates as a timeline and its photos as download buttons at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-updates-sample]");
      await sample.scrollIntoViewIfNeeded();
      const lists = sample.locator("[data-updates]");
      await expect(lists).toHaveCount(2);
      // The customer's list: four updates, no internal marks, dates without roles.
      const mine = lists.nth(0).locator("[data-update]");
      await expect(mine).toHaveCount(4);
      await expect(mine.nth(0)).toContainText("Status changed from Open to Being looked at");
      await expect(mine.nth(1)).toContainText("We will visit on Thursday to check the inverter.");
      await expect(mine.nth(2)).toContainText("Technician assigned");
      await expect(lists.nth(0)).not.toContainText("Company,");
      for (const node of await lists.nth(0).locator("li > span[aria-hidden]").all()) await expect(node).toHaveAttribute("aria-hidden", "true");
      // The company's list says who acted and whether each entry is shared or internal, in words.
      const theirs = lists.nth(1).locator("[data-update]");
      await expect(theirs.nth(1)).toContainText("Company,");
      await expect(theirs.nth(3)).toContainText("Customer,");
      await expect(theirs.nth(2)).toHaveAttribute("data-shared", "false");
      await expect(theirs.nth(2)).toContainText("Internal");
      await expect(theirs.nth(0)).toContainText("Shown to the customer");
      // Photos: two download buttons at 44 px, and the empty text when there are none.
      const buttons = sample.locator("[data-photos] [data-download]");
      await expect(buttons).toHaveCount(2);
      await expect(buttons.first()).toHaveText("Download photo 1");
      for (const button of await buttons.all()) expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      await expect(sample.locator("[data-no-photos]")).toHaveText("No photos yet.");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-updates-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/support-case-${theme}-${width}.png` });
    });
  }
}
