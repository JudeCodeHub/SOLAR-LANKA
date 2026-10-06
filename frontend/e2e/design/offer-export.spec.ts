import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`the keep-a-copy section looks right when not asked for, preparing, ready and failed at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-export-sample]");
      await sample.scrollIntoViewIfNeeded();
      const panels = sample.locator("[data-export]");
      await expect(panels).toHaveCount(4);
      await expect(panels.nth(0)).toHaveAttribute("data-export-state", "idle");
      await expect(panels.nth(1)).toHaveAttribute("data-export-state", "preparing");
      await expect(panels.nth(2)).toHaveAttribute("data-export-state", "ready");
      await expect(panels.nth(3)).toHaveAttribute("data-export-state", "failed");
      for (const panel of await panels.all()) await expect(panel.getByRole("heading", { name: "Keep a copy" })).toBeVisible();
      // Not asked for: one button to prepare the PDF.
      const request = panels.nth(0).locator("[data-export-request]");
      await expect(request).toHaveText("Prepare PDF");
      expect((await request.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      // Preparing: a turning dial and the words, no button.
      await expect(panels.nth(1).locator("[data-export-pending]")).toContainText("Your PDF is being prepared.");
      await expect(panels.nth(1).locator("[data-export-pending] svg")).toHaveCount(1);
      await expect(panels.nth(1).getByRole("button")).toHaveCount(0);
      // Ready: the confirmation in words and a download button.
      await expect(panels.nth(2).locator("[data-export-ready]")).toHaveText("Your PDF is ready.");
      const download = panels.nth(2).locator("[data-export-download]");
      await expect(download).toHaveText("Download PDF");
      expect((await download.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      // Failed: the shared error message, with the way to try again still there.
      await expect(panels.nth(3).getByRole("alert")).toBeVisible();
      await expect(panels.nth(3).locator("[data-export-request]")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-export-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/export-${theme}-${width}.png` });
    });
  }
}
