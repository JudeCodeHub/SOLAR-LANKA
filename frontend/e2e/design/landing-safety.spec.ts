import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 1280]) {
    test(`the safety section leads with the stop rule at ${width} px in the ${theme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const section = page.locator("[data-safety-section]");
      await section.scrollIntoViewIfNeeded();
      await expect(section.getByRole("heading", { level: 2, name: "Safety comes first." })).toBeVisible();
      const rule = section.locator("[data-safety-rule]");
      await expect(rule).toContainText("Stop: this may be dangerous");
      await expect(rule).toContainText("call a qualified technician");
      await expect(section.getByRole("img", { name: /technician arriving at a home/i })).toBeVisible();
      // The rule comes before the link to the lookup, in reading order.
      const ruleBox = await rule.boundingBox();
      const link = section.getByRole("link", { name: "Look up an error code" });
      const linkBox = await link.boundingBox();
      expect(ruleBox && linkBox && ruleBox.y < linkBox.y).toBe(true);
      await expect(link).toHaveAttribute("href", "/troubleshooting");
      expect(linkBox && linkBox.height >= 44).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-safety-section]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await section.screenshot({ path: `e2e/.tmp/safety-${theme}-${width}.png` });
    });
  }
}
