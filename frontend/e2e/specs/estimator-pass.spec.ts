import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures.ts";

const range = (minimum: string, maximum: string) => ({ minimum, maximum });
const source = (title: string) => ({ publisher: "Sample publisher", title, unit: "per kWh", reviewed_on: "2026-09-28", effective_from: "2026-08-25", limitation: "A planning figure.", url: "https://example.com/source" });
const estimate = {
  config_id: "11111111-1111-4111-8111-111111111111",
  config_version: 3,
  disclaimer: "Planning estimate, not a quotation.",
  scenario: "grid_net_metering_no_backup",
  sizing: { capacity_kwp: range("5.2", "6.1"), panel_count: range("10", "12"), installed_area_m2: range("26", "31"), annual_generation_kwh: range("7100", "8300"), average_monthly_generation_kwh: range("590", "690"), roof_panel_capacity: 20 },
  financial: { status: "ok", installed_cost_lkr: range("1500000", "1900000"), baseline_monthly_bill_lkr: "20000", monthly_savings_lkr: range("14000", "17000"), annual_savings_lkr: range("168000", "204000"), simple_payback_years: range("8", "11") },
  sources: { yield: source("Yield"), tariff: source("Tariff"), cost: source("Cost") },
};

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function violations(page: Page) {
  const result = await new AxeBuilder({ page }).include("[data-estimator-page]").withTags(AXE_TAGS).analyze();
  return result.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
}

/** Controls that are too small to press, ignoring links written inside a sentence. */
async function smallControls(page: Page) {
  return page.locator("[data-estimator-page]").locator("button, input:not([type=radio]):not([type=checkbox]), select, textarea, summary, a:not(p a):not(li > a)").evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const box = node.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== "hidden" && box.height < 44 - 0.5;
      })
      .map((node) => `${node.tagName.toLowerCase()} ${(node.textContent ?? "").trim().slice(0, 30)} ${Math.round(node.getBoundingClientRect().height)}px`),
  );
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 768, 1280]) {
    test(`the whole estimator passes axe, fits and has big targets, empty, with errors, with results and out of date at ${width} px (${theme})`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.route("**/estimates/preview", (route) => route.fulfill({ json: estimate }));
      const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

      // The empty form.
      await page.goto("/estimator");
      await page.locator("[data-estimator-page] form").waitFor();
      expect(await fits()).toBe(true);
      expect(await violations(page)).toEqual([]);
      expect(await smallControls(page)).toEqual([]);

      // The form with its error summary.
      await page.getByRole("button", { name: "Calculate estimate" }).click();
      await page.locator("[data-error-summary]").waitFor();
      expect(await fits()).toBe(true);
      expect(await violations(page)).toEqual([]);
      expect(await smallControls(page)).toEqual([]);

      // The results, with every accordion item opened.
      await page.getByLabel(/Monthly electricity use/).fill("400");
      await page.getByLabel("District").selectOption({ label: "Colombo" });
      await page.getByLabel(/Usable roof area/).fill("60");
      await page.getByRole("button", { name: "Calculate estimate" }).click();
      await page.locator("[data-results-hero]").waitFor();
      await page.locator("[data-results] svg.recharts-surface").first().waitFor();
      for (const summary of await page.locator("[data-assumptions] summary").all()) {
        const item = summary.locator("..");
        if (!(await item.evaluate((element) => (element as HTMLDetailsElement).open))) await summary.click();
      }
      expect(await fits()).toBe(true);
      expect(await violations(page)).toEqual([]);
      expect(await smallControls(page)).toEqual([]);

      // The results after an input changed.
      await page.getByLabel(/Monthly electricity use/).fill("500");
      await page.locator("[data-stale]").waitFor();
      expect(await fits()).toBe(true);
      expect(await violations(page)).toEqual([]);
      if (process.env.HERO_SHOTS) await page.screenshot({ path: `e2e/.tmp/pass-${theme}-${width}.png`, fullPage: true });
    });
  }
}
