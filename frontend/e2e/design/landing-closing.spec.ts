import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 768, 1280]) {
    test(`the closing band is orange with dark ink, one action, and joins the footer at ${width} px in the ${theme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const band = page.locator("[data-closing-band]");
      await band.scrollIntoViewIfNeeded();
      const look = await band.evaluate((element) => ({
        background: getComputedStyle(element).backgroundColor,
        heading: getComputedStyle(element.querySelector("h2")!).color,
      }));
      expect(look.background).toBe("rgb(255, 106, 26)");
      // Dark ink in both themes: the light theme's ink or the night theme's near-black.
      expect(look.heading).toBe(theme === "light" ? "rgb(26, 21, 17)" : "rgb(13, 11, 9)");
      const action = band.getByRole("link", { name: "Estimate my system" });
      await expect(action).toHaveAttribute("href", "/estimator");
      const box = await action.boundingBox();
      expect(box && box.height >= 44).toBe(true);
      // The band ends exactly where the footer begins.
      const gap = await page.evaluate(() => document.querySelector("[data-closing-band]")!.getBoundingClientRect().bottom - document.querySelector("footer")!.getBoundingClientRect().top);
      expect(Math.abs(gap)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-closing-band]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await page.screenshot({ path: `e2e/.tmp/closing-${theme}-${width}.png` });
    });
  }
}
