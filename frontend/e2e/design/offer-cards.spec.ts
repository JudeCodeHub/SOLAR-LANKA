import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`each offer shows its company, a state chip, the total, when it ends and a way in at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-offers-sample]");
      await sample.scrollIntoViewIfNeeded();
      const cards = sample.locator("[data-offer]");
      await expect(cards).toHaveCount(4);
      const expected = [
        ["active", "Total: LKR 1,640,000", "Valid until 1 November 2026"],
        ["active", "Total: LKR 1,580,000", "Valid until 8 October 2026"],
        ["accepted", "Total: LKR 1,720,000", "1 November 2026"],
        ["expired", "Total: LKR 1,495,000", "20 September 2026"],
      ] as const;
      for (const [index, [state, total, expiry]] of expected.entries()) {
        const card = cards.nth(index);
        await expect(card).toHaveAttribute("data-offer", state);
        await expect(card.locator("[data-state]")).toHaveAttribute("data-state", state);
        await expect(card.locator("[data-state] svg")).toHaveCount(1);
        await expect(card.locator("[data-total]")).toContainText(total);
        await expect(card.locator("[data-expiry]")).toContainText(expiry);
        const link = card.getByRole("link", { name: "View the offer" });
        await expect(link).toHaveAttribute("href", `/my/requests/r1/offers/q${index + 1}`);
        expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      // Only the offer ending within three days carries the "ends soon" line.
      await expect(sample.locator("[data-soon]")).toHaveCount(1);
      await expect(cards.nth(1).locator("[data-soon]")).toBeVisible();
      // Every state word is different, so the chips never rely on colour alone.
      const words = await sample.locator("[data-state]").allTextContents();
      expect(new Set(words).size).toBe(3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-offers-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/offers-${theme}-${width}.png` });
    });
  }
}
