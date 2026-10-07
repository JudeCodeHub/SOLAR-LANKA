import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  test(`every empty-state drawing shows, is hidden from screen readers and passes axe (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
    const sample = page.locator("[data-art-sample]");
    await sample.scrollIntoViewIfNeeded();
    const arts = sample.locator("[data-slot='empty-art']");
    await expect(arts).toHaveCount(6);
    for (const art of await arts.all()) {
      await expect(art).toHaveAttribute("aria-hidden", "true");
      expect((await art.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(90);
    }
    // The ordinary empty state on the design page carries the default drawing and no icon disc.
    const panel = page.locator("[data-slot='state-panel']").first();
    await expect(panel.locator("[data-slot='empty-art']")).toHaveCount(1);
    const { violations } = await new AxeBuilder({ page }).include("[data-art-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  });
}
