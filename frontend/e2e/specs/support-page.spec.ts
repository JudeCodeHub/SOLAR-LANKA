import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "../fixtures.ts";

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 1280]) {
    test(`the support page says what is safe first, then three steps and two actions at ${width} px (${theme})`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/support");
      await expect(page.getByRole("heading", { level: 1, name: "Support" })).toBeVisible();
      // The safety message comes before the steps and before the actions, in the page order.
      const order = await page.evaluate(() => {
        const position = (selector: string) => (document.querySelector(selector)?.getBoundingClientRect().top ?? -1) + window.scrollY;
        return [position("[data-safety-first]"), position("[data-steps]"), position("main a[href='/troubleshooting']")];
      });
      expect(order[0]).toBeGreaterThan(0);
      expect(order[0]).toBeLessThan(order[1]!);
      expect(order[1]).toBeLessThan(order[2]!);
      const safety = page.locator("[data-safety-first]");
      await expect(safety).toContainText("If it may be dangerous");
      expect(await safety.evaluate((element) => parseFloat(getComputedStyle(element).borderTopWidth))).toBeGreaterThanOrEqual(2);
      await expect(page.locator("[data-steps] li")).toHaveCount(3);
      await expect(page.locator("[data-steps] li").nth(1)).toContainText("stop and call a qualified technician");
      await expect(page.locator("main img").first()).toBeVisible();
      const lookup = page.getByRole("link", { name: "Look up your equipment" });
      const report = page.getByRole("link", { name: "Report a problem to your installer" });
      await expect(lookup).toHaveAttribute("href", "/troubleshooting");
      await expect(report).toHaveAttribute("href", "/my/support");
      for (const link of [lookup, report]) expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await page.screenshot({ path: `e2e/.tmp/support-${theme}-${width}.png`, fullPage: true });
    });
  }
}
