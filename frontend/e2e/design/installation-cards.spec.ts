import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`each installation shows how far along it is in words and in a step track at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-installations-sample]");
      await sample.scrollIntoViewIfNeeded();
      const cards = sample.locator("[data-installation]");
      await expect(cards).toHaveCount(4);
      const expected = [
        ["going", "0 of 8 steps complete", 0],
        ["going", "3 of 8 steps complete", 3],
        ["going", "7 of 8 steps complete", 7],
        ["done", "All steps complete", 8],
      ] as const;
      for (const [index, [state, words, done]] of expected.entries()) {
        const card = cards.nth(index);
        await expect(card).toHaveAttribute("data-installation", state);
        await expect(card).toContainText(words);
        await expect(card.locator("[data-segment]")).toHaveCount(8);
        await expect(card.locator("[data-segment='done']")).toHaveCount(done);
        // Only an unfinished installation has a "next" step marked.
        await expect(card.locator("[data-segment='next']")).toHaveCount(done === 8 ? 0 : 1);
        // The track is decoration; the progress element says the same in words for assistive technology.
        await expect(card.locator("[data-track]")).toHaveAttribute("aria-hidden", "true");
        await expect(card.getByRole("progressbar", { name: words })).toHaveAttribute("value", String(done));
        const link = card.getByRole("link");
        await expect(link).toHaveAttribute("href", `/my/installations/i${index + 1}`);
        expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      await expect(cards.nth(3).locator("span").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-installations-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/installations-${theme}-${width}.png` });
    });
  }
}
