import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`sent revisions are shown frozen with their own download, and the draft has none, at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-history-sample]");
      await sample.scrollIntoViewIfNeeded();
      const revisions = sample.locator("[data-revision]");
      await expect(revisions).toHaveCount(3);
      // Newest first, each folded away with its number, status and total in the title.
      await expect(revisions.nth(0)).toHaveAttribute("data-revision", "3");
      for (const revision of await revisions.all()) await expect(revision).toHaveJSProperty("open", false);
      await expect(revisions.nth(0).locator("summary")).toContainText("Revision 3");
      await expect(revisions.nth(1).locator("summary")).toContainText("Revision 2");
      await expect(revisions.nth(1).locator("summary")).toContainText("1,600,000");
      for (const revision of await revisions.all()) expect((await revision.locator("summary").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      // The draft: not visible to the customer, and no download.
      await revisions.nth(0).locator("summary").click();
      await expect(revisions.nth(0)).toContainText("Not visible to the customer.");
      await expect(revisions.nth(0).locator("[data-pdf-download]")).toHaveCount(0);
      // A sent revision: its sent date, its total change from the one before, its lines and terms read-only, and a 44 px download.
      await revisions.nth(1).locator("summary").focus();
      await page.keyboard.press("Enter");
      await expect(revisions.nth(1)).toHaveJSProperty("open", true);
      await expect(revisions.nth(1)).toContainText("Sent 27 September 2026");
      await expect(revisions.nth(1).locator("[data-revision-lines] tbody tr")).toHaveCount(3);
      await expect(revisions.nth(1).locator("[data-revision-totals]")).toContainText("1,600,000");
      await expect(revisions.nth(1).locator("input, textarea, select")).toHaveCount(0);
      const download = revisions.nth(1).locator("[data-pdf-download]");
      await expect(download).toHaveText("Download PDF of this revision");
      expect((await download.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      await revisions.nth(2).locator("summary").click();
      await expect(revisions.nth(2).locator("[data-pdf-download]")).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-history-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/history-${theme}-${width}.png` });
    });
  }
}
