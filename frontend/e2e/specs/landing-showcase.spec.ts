import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "../fixtures.ts";

test.describe("the landing catalogue showcase", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`shows real products on cards, links both catalogues and passes axe in the ${theme} theme`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto("/");
      const showcase = page.locator("[data-catalogue-showcase]");
      await showcase.scrollIntoViewIfNeeded();
      await expect(showcase.getByRole("link", { name: "Browse solar panels" })).toHaveAttribute("href", "/panels");
      await expect(showcase.getByRole("link", { name: "Browse inverters" })).toHaveAttribute("href", "/inverters");
      for (const group of ["panels", "inverters"]) {
        const cards = showcase.locator(`[data-showcase="${group}"] li`);
        expect(await cards.count()).toBeGreaterThan(0);
        const first = cards.first();
        await expect(first.getByRole("img")).toBeVisible();
        await expect(first.getByRole("heading", { level: 4 }).getByRole("link")).toBeVisible();
        await expect(first.getByText("Sample catalogue entry")).toBeVisible();
        expect(await first.locator("dd").count()).toBe(2);
      }
      const { violations } = await new AxeBuilder({ page }).include("[data-catalogue-showcase]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await showcase.screenshot({ path: `e2e/.tmp/showcase-${theme}.png` });
    });
  }

  test("on a phone the cards fit and there is no sideways scroll", async ({ page, signInAs }) => {
    signInAs(null);
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/");
    await page.locator("[data-catalogue-showcase]").scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
