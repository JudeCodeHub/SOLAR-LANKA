import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

// The sign-in card's footer ("Secured by Clerk" over Clerk's development-mode strip) is Clerk's own markup and is shown only in development, so it is left out.
const routes = ["/", "/panels", "/inverters", "/panels/compare", "/inverters/compare", "/companies", "/learn", "/estimator", "/troubleshooting", "/support", "/sign-in", "/sign-up", "/design"];

for (const theme of ["light", "dark"] as const) {
  test(`no axe violations on any page that opens without signing in (${theme})`, async ({ page }) => {
    test.setTimeout(240000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    const found: string[] = [];
    for (const route of routes) {
      await page.goto(route, { waitUntil: "load", timeout: 60000 });
      await page.waitForTimeout(800);
      const { violations } = await new AxeBuilder({ page }).exclude(".cl-footer").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      for (const v of violations) found.push(`${route} ${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
    }
    expect(found).toEqual([]);
  });
}
