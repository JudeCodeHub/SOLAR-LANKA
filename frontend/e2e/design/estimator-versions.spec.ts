import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`estimator versions read like a changelog: the one in use for each scenario stands out, drafts and archived ones are marked at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-versions-sample]");
      await sample.scrollIntoViewIfNeeded();
      const cards = sample.locator("[data-version]");
      await expect(cards).toHaveCount(4);
      // The newest published version of each scenario is in use: version 4 (net metering) and version 3 (net plus); not the draft, not the archived one.
      await expect(sample.locator("[data-current='true']")).toHaveCount(2);
      await expect(cards.nth(1)).toHaveAttribute("data-current", "true");
      await expect(cards.nth(2)).toHaveAttribute("data-current", "true");
      await expect(cards.nth(0)).toHaveAttribute("data-current", "false");
      await expect(cards.nth(3)).toHaveAttribute("data-current", "false");
      await expect(cards.nth(1).locator("[data-badge='current']")).toBeVisible();
      await expect(cards.nth(1).locator("[data-badge='current'] svg")).toHaveCount(1);
      // Words for each state: the draft, the archived one and the scenario are written out.
      await expect(cards.nth(0).locator("[data-badge='status']")).toHaveText("Draft");
      await expect(cards.nth(3).locator("[data-badge='archived']")).toBeVisible();
      await expect(cards.nth(0).locator("[data-scenario]")).not.toHaveText("");
      // The in-use cards have the green bar and tint; the others are plain.
      const looks = await cards.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).boxShadow.includes("inset")));
      expect(looks).toEqual([false, true, true, false]);
      for (const card of await cards.all()) expect((await card.getByRole("link").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-versions-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/versions-${theme}-${width}.png` });
    });
  }
}
