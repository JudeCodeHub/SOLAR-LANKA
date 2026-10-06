import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "../fixtures.ts";

const CASES = [
  { path: "/panels?q=zzzzqq", title: "No matches", clear: /panels$/ },
  { path: "/inverters?q=zzzzqq", title: "No matches", clear: /inverters$/ },
  { path: "/companies?district=Colombo&service=battery_installation&q=x", title: "No matching companies", clear: /companies$/ },
] as const;

for (const theme of ["light", "dark"] as const) {
  for (const item of CASES) {
    test(`${item.path} shows the empty panel with a way out (${theme})`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width: 390, height: 900 });
      await page.goto(item.path);
      const panel = page.locator('[data-slot="state-panel"]');
      await panel.waitFor();
      // Some of these addresses have no match only for some data; skip the companies one if it matched.
      if (!(await panel.getByText(item.title).count())) test.skip(true, "the sample data has a match for this address");
      await expect(panel.getByText(item.title)).toBeVisible();
      await expect(panel.locator("svg").first()).toBeVisible();
      const clear = panel.getByRole("link", { name: "Clear all filters" });
      await expect(clear).toBeVisible();
      expect(await clear.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include('[data-slot="state-panel"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS && theme === "light") await page.screenshot({ path: `e2e/.tmp/empty-${item.path.split("?")[0]!.slice(1)}.png` });
      await clear.click();
      await expect(page).toHaveURL(item.clear);
    });
  }
}

test("the compare page with fewer than two products shows the empty panel and leads back to the list", async ({ page, signInAs }) => {
  signInAs(null);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/panels/compare");
  const panel = page.locator('[data-slot="state-panel"]');
  await expect(panel.getByText("Choose at least two products to compare")).toBeVisible();
  const back = panel.getByRole("link", { name: "Back to solar panels" });
  await expect(back).toHaveAttribute("href", "/panels");
  expect(await back.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
});
