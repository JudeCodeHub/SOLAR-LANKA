import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const RULES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test("the teaser's figures count up once when scrolled into view and end on their values", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto("/");
  const output = page.locator('[data-count-up="7,300"]');
  await output.waitFor({ state: "attached" });
  // Not in view yet: it waits at zero.
  await expect(output).toHaveText("0");
  await output.scrollIntoViewIfNeeded();
  await page.locator("[data-estimate-teaser]").scrollIntoViewIfNeeded();
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    seen.add((await output.textContent()) ?? "");
    await page.waitForTimeout(40);
  }
  await expect(output).toHaveText("7,300");
  expect(seen.size, "it passed through other values on the way").toBeGreaterThan(2);
  await expect(page.locator('[data-count-up="5.4"]')).toHaveText("5.4");
  await expect(page.locator('[data-count-up="1.7"]')).toHaveText("1.7");
  // Once only: leaving and returning does not count again.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.locator("[data-estimate-teaser]").scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await expect(output).toHaveText("7,300");
});

test("with reduced motion the figures show their values at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const output = page.locator('[data-count-up="7,300"]');
  await output.waitFor({ state: "attached" });
  await expect(output).toHaveText("7,300");
});

for (const theme of ["light", "dark"] as const) {
  test(`the teaser has no axe violations in the ${theme} theme and its sample label is visible`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const card = page.locator("[data-estimate-teaser]");
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByText("Sample figures")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open the estimator" })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).include("#teaser-title").include("[data-estimate-teaser]").withTags(RULES).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (process.env.HERO_SHOTS) await page.locator("section[aria-labelledby=teaser-title]").screenshot({ path: `e2e/.tmp/teaser-${theme}.png` });
  });
}
