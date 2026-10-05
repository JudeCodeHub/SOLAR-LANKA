import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const RULES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SIZES = [
  { width: 320, height: 640 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

for (const theme of ["light", "dark"] as const) {
  for (const size of SIZES) {
    test(`the landing hero fits at ${size.width} px in the ${theme} theme`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("/");
      const hero = page.locator("[data-hero]");
      await expect(page.getByRole("heading", { level: 1, name: "Know your solar before you sign." })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      for (const name of ["Estimate my system", "Browse panels"]) {
        const box = await hero.getByRole("link", { name }).boundingBox();
        expect(box && box.height >= 44 && box.x >= 0 && box.x + box.width <= size.width, name).toBe(true);
      }
      await expect(hero.getByRole("img", { name: /system size: 5.4 kW/i })).toBeVisible();
      await expect(hero.getByText("Sample figures")).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).include("[data-hero]").withTags(RULES).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await hero.screenshot({ path: `e2e/.tmp/hero/${theme}-${size.width}.png` });
    });
  }
}
