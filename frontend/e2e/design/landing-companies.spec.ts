import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Works with or without an API behind the page: listings are checked when there are some, the unavailable message otherwise. */
for (const theme of ["light", "dark"] as const) {
  test(`the companies section labels its companies fictional, links the directory and passes axe in the ${theme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const section = page.locator("[data-companies-showcase]");
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByText("Fictional companies for this demonstration")).toBeVisible();
    await expect(section.getByRole("link", { name: "See all companies" })).toHaveAttribute("href", "/companies");
    const rows = section.getByRole("heading", { level: 3 });
    if ((await rows.count()) > 0) {
      await expect(rows.first().getByRole("link")).toHaveAttribute("href", /^\/companies\//);
      await expect(section.getByText("Approved listing").first()).toBeVisible();
    } else {
      await expect(section.getByRole("alert")).toBeVisible();
    }
    const { violations } = await new AxeBuilder({ page }).include("[data-companies-showcase]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    if (process.env.HERO_SHOTS) await page.locator("section[aria-labelledby=companies-title]").screenshot({ path: `e2e/.tmp/companies-${theme}.png` });
  });
}

test("on a phone the section fits without sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await page.locator("[data-companies-showcase]").scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
