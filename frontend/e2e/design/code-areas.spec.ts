import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`the two code areas are monospace, carry their help, show an error right under the area and a published one is read-only at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-code-sample]");
      await sample.scrollIntoViewIfNeeded();
      const area = sample.locator("#d-assumptions");
      // Monospace face, at least 12 rows tall, labelled, with the JSON mark and its help linked by aria-describedby.
      expect(await area.evaluate((element) => getComputedStyle(element).fontFamily)).toMatch(/mono|courier|plex/i);
      expect((await area.boundingBox())?.height ?? 0).toBeGreaterThan(200);
      await expect(sample.locator("[data-code-area='assumptions']")).toContainText("JSON");
      await expect(area).toHaveAttribute("aria-describedby", "d-assumptions-help");
      await expect(sample.locator("#d-assumptions-help")).toBeVisible();
      // Check with bad input: each problem appears directly under its own area, with an icon, and the area is marked invalid.
      await sample.locator("[data-check]").click();
      const first = sample.locator("[data-error='assumptions']");
      await expect(first).toBeVisible();
      await expect(first.locator("svg")).toHaveCount(1);
      await expect(area).toHaveAttribute("aria-invalid", "true");
      await expect(area).toHaveAttribute("aria-describedby", "d-assumptions-help d-assumptions-error");
      const [areaBox, errorBox] = await Promise.all([area.boundingBox(), first.boundingBox()]);
      expect(errorBox && areaBox && errorBox.y >= areaBox.y + areaBox.height - 1).toBe(true);
      await expect(sample.locator("[data-error='sources']")).toBeVisible();
      // Fixing the first area clears its error and leaves the other's.
      await area.fill('{ "export_rate_lkr_per_kwh": "20.00" }');
      await sample.locator("[data-check]").click();
      await expect(sample.locator("[data-error='assumptions']")).toHaveCount(0);
      await expect(sample.locator("[data-error='sources']")).toBeVisible();
      // A published version is read-only and says so.
      const readOnly = sample.locator("#d-readonly");
      await expect(readOnly).toHaveAttribute("readonly", "");
      await expect(sample.locator("[data-code-area='readonly']")).toContainText("Read-only");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-code-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/code-${theme}-${width}.png` });
    });
  }
}
