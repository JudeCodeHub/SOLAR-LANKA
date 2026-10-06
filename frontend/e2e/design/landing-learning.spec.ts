import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Works with or without an API behind the page: guides are checked when there are some, the unavailable message otherwise. */
for (const theme of ["light", "dark"] as const) {
  test(`the learning teaser links real guides and passes axe in the ${theme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const section = page.locator("[data-learning-teaser]");
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByRole("link", { name: "All guides" })).toHaveAttribute("href", "/learn");
    const titles = section.getByRole("heading", { level: 3 });
    const count = await titles.count();
    if (count > 0) {
      expect(count).toBeLessThanOrEqual(3);
      await expect(section.getByRole("img").first()).toBeVisible();
      await expect(titles.first().getByRole("link")).toHaveAttribute("href", /^\/learn\/[a-z0-9-]+$/);
    } else {
      await expect(section.getByRole("alert")).toBeVisible();
    }
    const { violations } = await new AxeBuilder({ page }).include("[data-learning-teaser]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    if (process.env.HERO_SHOTS) await page.locator("section[aria-labelledby=learn-title]").screenshot({ path: `e2e/.tmp/learning-${theme}.png` });
  });
}

test("the first guide's link opens that real article, and the section fits on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  const section = page.locator("[data-learning-teaser]");
  await section.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const first = section.getByRole("heading", { level: 3 }).first();
  if ((await first.count()) === 0) return;
  const title = (await first.textContent())?.trim() ?? "";
  await first.getByRole("link").click();
  await expect(page).toHaveURL(/\/learn\/[a-z0-9-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
});
