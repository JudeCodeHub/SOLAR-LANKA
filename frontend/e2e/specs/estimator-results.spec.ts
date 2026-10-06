import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures.ts";

const range = (minimum: string, maximum: string) => ({ minimum, maximum });
const source = (title: string) => ({ publisher: "Sample publisher", title, unit: "per kWh", reviewed_on: "2026-09-28", effective_from: "2026-08-25", limitation: "A planning figure.", url: "https://example.com/source" });

/** An estimate answer in the shape the API gives, so the page can be shown without the estimator behind it. */
function preview(annual: boolean) {
  return {
    config_id: "11111111-1111-4111-8111-111111111111",
    config_version: 3,
    disclaimer: "Planning estimate, not a quotation.",
    scenario: "grid_net_metering_no_backup",
    sizing: {
      capacity_kwp: range("5.2", "6.1"),
      panel_count: range("10", "12"),
      installed_area_m2: range("26", "31"),
      annual_generation_kwh: annual ? range("7100", "8300") : null,
      average_monthly_generation_kwh: annual ? range("590", "690") : null,
      roof_panel_capacity: 20,
    },
    financial: {
      status: "ok",
      installed_cost_lkr: range("1500000", "1900000"),
      baseline_monthly_bill_lkr: "20000",
      monthly_savings_lkr: annual ? range("14000", "17000") : null,
      annual_savings_lkr: annual ? range("168000", "204000") : null,
      simple_payback_years: annual ? range("8", "11") : null,
    },
    sources: { yield: source("Yield"), tariff: source("Tariff"), cost: source("Cost") },
  };
}

async function calculate(page: Page, annual: boolean) {
  await page.route("**/estimates/preview", (route) => route.fulfill({ json: preview(annual) }));
  await page.goto("/estimator");
  await page.getByLabel(/Monthly electricity use/).fill("400");
  await page.getByLabel("District").selectOption({ label: "Colombo" });
  await page.getByLabel(/Usable roof area/).fill("60");
  await page.getByRole("button", { name: "Calculate estimate" }).click();
  await page.locator("[data-results-hero]").waitFor();
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 1280]) {
    test(`the results open with two dials that show the real range and read out as a sentence at ${width} px (${theme})`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await calculate(page, true);
      const hero = page.locator("[data-results-hero]");
      await expect(hero.getByRole("img", { name: "System size: 5.2 to 6.1 kWp, on a scale from 0 to 10" })).toBeVisible();
      await expect(hero.getByRole("img", { name: "Yearly generation: 7,100 to 8,300 kWh per year, on a scale from 0 to 20000" })).toBeVisible();
      // The arc covers the band between the two ends, not from zero.
      const arcs = hero.locator("path.dial-sweep");
      await expect(arcs).toHaveCount(2);
      const first = await arcs.first().evaluate((element) => ({ array: element.getAttribute("stroke-dasharray"), offset: element.getAttribute("stroke-dashoffset") }));
      expect(parseFloat(first.offset ?? "0")).toBeLessThan(-40);
      expect(parseFloat(first.array ?? "0")).toBeLessThan(20);
      // The result tables below still carry the same figures.
      await expect(page.locator("[data-results]").getByText("5.2 to 6.1").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-results]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await page.screenshot({ path: `e2e/.tmp/results-${theme}-${width}.png`, fullPage: true });
    });
  }
}

test("when yearly generation cannot be worked out the second dial says why instead of showing zero", async ({ page, signInAs }) => {
  signInAs(null);
  await page.setViewportSize({ width: 1280, height: 900 });
  await calculate(page, false);
  const hero = page.locator("[data-results-hero]");
  await expect(hero.getByRole("img")).toHaveCount(1);
  await expect(hero.locator("[data-hero-missing]")).toContainText("Yearly generation");
  await expect(hero.locator("[data-hero-missing]")).not.toContainText(/\b0\b/);
});
