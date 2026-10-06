import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

const STAFF = [
  ["Company dashboard", "/company"],
  ["Support requests", "/company/support"],
  ["Request inbox", "/company/inbox"],
  ["Product offers", "/company/offers"],
  ["Installations", "/company/installations"],
  ["Company profile", "/company/profile"],
] as const;
const TECHNICIAN = [
  ["My visits", "/technician"],
  ["My support requests", "/technician/support"],
] as const;

for (const theme of ["light", "dark"] as const) {
  test(`the company workspace shows each role its own links and marks only the current page (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
    const sample = page.locator("[data-company-shell-sample]");
    await sample.scrollIntoViewIfNeeded();
    for (const [role, links, current] of [["company_admin", STAFF, "Request inbox"], ["technician", TECHNICIAN, "My support requests"]] as const) {
      const shell = sample.locator(`[data-shell-role='${role}']`);
      const nav = shell.getByRole("navigation", { name: /Company workspace/ });
      await expect(nav).toBeVisible();
      const items = nav.getByRole("link");
      await expect(items).toHaveCount(links.length);
      for (const [index, [label, href]] of links.entries()) {
        await expect(items.nth(index)).toHaveText(label);
        await expect(items.nth(index)).toHaveAttribute("href", href);
        await expect(items.nth(index).locator("svg")).toHaveCount(1);
        expect((await items.nth(index).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      // One link is current, and the parent dashboard link is not current just because the page sits below it.
      await expect(nav.locator("[aria-current='page']")).toHaveCount(1);
      await expect(nav.locator("[aria-current='page']")).toHaveText(current);
    }
    // A technician sees no company links, and company staff see no technician links.
    await expect(sample.locator("[data-shell-role='technician'] a[href^='/company']")).toHaveCount(0);
    await expect(sample.locator("[data-shell-role='company_admin'] a[href^='/technician']")).toHaveCount(0);
    const { violations } = await new AxeBuilder({ page }).include("[data-company-shell-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/company-shell-${theme}.png` });
  });
}
