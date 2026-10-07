import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

const ADMIN = [
  ["Company reviews", "/admin/companies"],
  ["Catalogue", "/admin/catalogue"],
  ["Estimator settings", "/admin/estimator"],
  ["Users", "/admin/users"],
  ["Troubleshooting", "/admin/troubleshooting"],
  ["Learning content", "/admin/education"],
  ["Activity and audit", "/admin/activity"],
] as const;

for (const theme of ["light", "dark"] as const) {
  test(`the administration area lists every admin page, marks the one you are on, and holds nothing from other areas (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
    const sample = page.locator("[data-admin-shell-sample]");
    await sample.scrollIntoViewIfNeeded();
    const nav = sample.getByRole("navigation", { name: /Administration/ });
    await expect(nav).toBeVisible();
    const items = nav.getByRole("link");
    await expect(items).toHaveCount(ADMIN.length);
    for (const [index, [label, href]] of ADMIN.entries()) {
      await expect(items.nth(index)).toHaveAttribute("href", href);
      await expect(items.nth(index).locator("svg")).toHaveCount(1);
      expect((await items.nth(index).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      await expect(items.nth(index)).toHaveText(label);
    }
    // A page below "Catalogue" marks the catalogue link, and only that one.
    await expect(nav.locator("[aria-current='page']")).toHaveCount(1);
    await expect(nav.locator("[aria-current='page']")).toHaveAttribute("href", "/admin/catalogue");
    // Nothing from the customer, company or technician areas is in this column.
    await expect(nav.locator("a[href^='/my'], a[href^='/company'], a[href^='/technician']")).toHaveCount(0);
    const { violations } = await new AxeBuilder({ page }).include("[data-admin-shell-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/admin-shell-${theme}.png` });
  });
}
