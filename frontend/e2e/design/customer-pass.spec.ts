import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

/** Every customer-area piece that is shown on the design page, by its test mark. */
const SAMPLES = [
  "[data-dashboard-sample]",
  "[data-requests-sample]",
  "[data-offers-sample]",
  "[data-offer-sample]",
  "[data-compare-sample]",
  "[data-export-sample]",
  "[data-installations-sample]",
  "[data-timeline-sample]",
  "[data-visits-sample]",
  "[data-favourites-sample]",
  "[data-support-sample]",
  "[data-notifications-sample]",
  "[data-settings-sample]",
];

const small = (page: Page, selector: string) =>
  page.locator(selector).locator("button, input:not([type=checkbox]):not([type=radio]), select, textarea, summary, a").evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const box = node.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && box.height < 43.5 && getComputedStyle(node).visibility !== "hidden";
      })
      .map((node) => `${node.tagName.toLowerCase()} ${(node.textContent ?? "").trim().slice(0, 30)} ${Math.round(node.getBoundingClientRect().height)}px`),
  );

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 768, 1280]) {
    test(`every customer-area piece on the design page passes axe, fits and has big targets at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      for (const selector of SAMPLES) {
        const sample = page.locator(selector).first();
        await expect(sample, selector).toBeAttached();
        await sample.scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${selector} fits`).toBe(true);
        const { violations } = await new AxeBuilder({ page }).include(selector).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
        expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`), `${selector} axe`).toEqual([]);
        expect(await small(page, selector), `${selector} targets`).toEqual([]);
      }
    });
  }
}
