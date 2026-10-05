import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const RULES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const theme of ["light", "dark"] as const) {
  test(`the design page has no WCAG 2.2 AA violations in the ${theme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/design");
    await page.locator("main").first().waitFor();
    await page.waitForLoadState("networkidle");
    await page.evaluate((name) => {
      const root = document.documentElement;
      root.classList.toggle("dark", name === "dark");
      root.dataset.theme = name;
    }, theme);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const { violations } = await new AxeBuilder({ page }).withTags(RULES).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  });
}
