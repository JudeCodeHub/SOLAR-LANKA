import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures.ts";

async function compareUrl(page: Page, kind: "panels" | "inverters", count: number) {
  await page.goto(`/${kind}`);
  const hrefs = await page.locator("[data-product] h3 a").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  const ids = hrefs.map((href) => href.split("?")[0]!.split("/").pop()!).slice(0, count);
  return `/${kind}/compare?ids=${ids.join(",")}`;
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`three panels compare cleanly at ${width} px (${theme}): differences are flagged, labels and header stay in view`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 800 });
      await page.goto(await compareUrl(page, "panels", 3));
      const root = page.locator("[data-compare-page]");
      await expect(root.getByRole("heading", { level: 1, name: "Compare solar panels" })).toBeVisible();
      const table = root.locator("[data-compare-table]");
      await expect(table.getByRole("columnheader")).toHaveCount(4);
      // Rated power differs between the three, and is flagged in words as well as by the orange edge.
      const power = table.locator("[data-row]", { hasText: "Rated power" });
      await expect(power).toHaveAttribute("data-relation", "differs");
      await expect(power.locator('[data-flag="differs"]')).toHaveText("Differs between products");
      // Where no product has a value, the row says so with the usual chip.
      expect(await table.locator("[data-unspecified]").count()).toBeGreaterThan(0);
      expect(await table.locator('[data-relation="none"], [data-relation="unspecified"]').count()).toBeGreaterThan(0);
      // Remove links are 44 px high.
      const remove = await table.getByRole("link", { name: /^Remove / }).first().evaluate((element) => element.getBoundingClientRect().height);
      expect(remove).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (width === 390) {
        // The table scrolls sideways inside its own region; the labels column stays at the left edge.
        const region = root.locator("[data-compare-region]");
        expect(await region.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
        await region.evaluate((element) => { element.scrollLeft = 200; });
        const [labelBox, regionBox] = await Promise.all([power.locator("th").first().boundingBox(), region.boundingBox()]);
        expect(labelBox && regionBox && Math.abs(labelBox.x - regionBox.x) < 3, "labels stay at the left edge").toBe(true);
      }
      const { violations } = await new AxeBuilder({ page }).include("[data-compare-page]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await page.screenshot({ path: `e2e/.tmp/compare-${theme}-${width}.png` });
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`three inverters compare like panels at ${width} px (${theme}): flags, pinned labels, 44 px remove links`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 800 });
      await page.goto(await compareUrl(page, "inverters", 3));
      const root = page.locator("[data-compare-page]");
      await expect(root.getByRole("heading", { level: 1, name: "Compare inverters" })).toBeVisible();
      const table = root.locator("[data-compare-table]");
      await expect(table.getByRole("columnheader")).toHaveCount(4);
      // Two of the three have a rated capacity and one does not, so that row says so in words rather than comparing a blank.
      const capacity = table.locator("[data-row]", { hasText: "Rated capacity" });
      await expect(capacity).toHaveAttribute("data-relation", "unspecified");
      await expect(capacity.locator('[data-flag="unspecified"]')).toHaveText("Not specified for some products");
      await expect(capacity.locator("[data-unspecified]")).toHaveCount(1);
      expect(await table.locator("[data-unspecified]").count()).toBeGreaterThan(0);
      const remove = await table.getByRole("link", { name: /^Remove / }).first().evaluate((element) => element.getBoundingClientRect().height);
      expect(remove).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (width === 390) {
        const region = root.locator("[data-compare-region]");
        await region.evaluate((element) => { element.scrollLeft = 200; });
        const [labelBox, regionBox] = await Promise.all([capacity.locator("th").first().boundingBox(), region.boundingBox()]);
        expect(labelBox && regionBox && Math.abs(labelBox.x - regionBox.x) < 3, "labels stay at the left edge").toBe(true);
      }
      const { violations } = await new AxeBuilder({ page }).include("[data-compare-page]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS && width === 390) await page.screenshot({ path: `e2e/.tmp/inv-compare-${theme}.png` });
    });
  }
}
