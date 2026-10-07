import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

const routes = ["/", "/estimator", "/learn", "/support", "/troubleshooting", "/sign-in", "/design"];

for (const [name, pattern] of [["fonts blocked", /\.woff2?(\?|$)/], ["photos missing", /\/(_next\/image|photos\/)|\.(webp|jpe?g|png|avif)(\?|$)/]] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`pages still read and fit with ${name} (${theme})`, async ({ page }) => {
      test.setTimeout(240000);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.route(pattern, (route) => route.abort());
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        for (const route of routes) {
          await page.goto(route, { waitUntil: "load", timeout: 60000 });
          await page.waitForTimeout(700);
          const main = page.locator("main").first();
          await expect(main, `${route}: main has content`).not.toBeEmpty();
          const heading = page.locator("main h1").first();
          await expect(heading, `${route}: heading shows`).toBeVisible();
          const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
          expect(fits, `${route} at ${width}: sideways scroll`).toBe(true);
          // A photo that failed to load is swapped for the warm gradient, so no broken-image mark is left on the page.
          const broken = await page.evaluate(() => [...document.querySelectorAll("main img")].filter((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth === 0 && getComputedStyle(image).display !== "none").length);
          if (name === "photos missing") expect(broken, `${route} at ${width}: broken images left`).toBe(0);
        }
      }
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude(".cl-footer").analyze();
      expect(violations.map((v) => v.id)).toEqual([]);
    });
  }
}
