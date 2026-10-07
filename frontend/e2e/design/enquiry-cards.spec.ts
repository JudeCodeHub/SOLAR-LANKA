import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`new, opened, responding, closed and withdrawn enquiries are distinct and a new one stands out at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-enquiries-sample]");
      await sample.scrollIntoViewIfNeeded();
      const cards = sample.locator("[data-status]");
      await expect(cards).toHaveCount(5);
      const words = ["New", "Opened", "Responding", "Closed", "Withdrawn by the customer"];
      for (const [index, word] of words.entries()) {
        await expect(cards.nth(index).locator("[data-chip]")).toHaveText(word);
        await expect(cards.nth(index).locator("[data-chip] svg")).toHaveCount(1);
        const link = cards.nth(index).getByRole("link");
        await expect(link).toHaveAttribute("href", `/company/inbox/e${index + 1}`);
        expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
        await expect(cards.nth(index)).toContainText("District:");
      }
      // Only the new one has the tint and bar; the others are quiet cards.
      const looks = await cards.evaluateAll((nodes) => nodes.map((node) => `${getComputedStyle(node).backgroundColor}|${getComputedStyle(node).boxShadow.includes("inset") ? "bar" : "flat"}`));
      expect(looks[0]).toContain("bar");
      for (const look of looks.slice(1)) expect(look).toContain("flat");
      expect(new Set(looks).size).toBe(2);
      // The chip colours differ for new, opened and responding.
      const chips = await sample.locator("[data-chip]").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor));
      expect(new Set(chips.slice(0, 3)).size).toBe(3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-enquiries-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/enquiries-${theme}-${width}.png` });
    });
  }
}
