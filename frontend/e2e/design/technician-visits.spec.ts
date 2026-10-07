import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [360, 1280]) {
    test(`a technician's visits are large tiles with the time, district and status, and today's stands out at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-technician-visits-sample]");
      await sample.scrollIntoViewIfNeeded();
      const tiles = sample.locator("[data-visit-tile]");
      await expect(tiles).toHaveCount(3);
      // Each tile: the time in Colombo, the district only (never the customer), the status in words, a link to the visit.
      await expect(tiles.nth(0)).toContainText("Tuesday, 6 October 2026");
      await expect(tiles.nth(0)).toContainText("10:00 to 12:00");
      await expect(tiles.nth(0)).toContainText("District: Colombo");
      await expect(tiles.nth(0).locator("[data-visit-status]")).toHaveText("Confirmed");
      await expect(tiles.nth(2).locator("[data-visit-status]")).toHaveText("Completed");
      for (const [index, id] of ["t1", "t2", "t3"].entries()) {
        const link = tiles.nth(index).getByRole("link");
        await expect(link).toHaveAttribute("href", `/technician/visits/${id}`);
        expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
        // The whole tile is the tap target, and it is at least 72 px tall.
        expect((await tiles.nth(index).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(72);
      }
      // Today's tile has the bar and tint; the others are plain.
      await expect(tiles.nth(0)).toHaveAttribute("data-today", "true");
      await expect(tiles.nth(1)).toHaveAttribute("data-today", "false");
      const looks = await tiles.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).boxShadow.includes("inset")));
      expect(looks).toEqual([true, false, false]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-technician-visits-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/tech-visits-${theme}-${width}.png` });
    });
  }
}
