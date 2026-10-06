import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const KINDS = ["Site survey", "System design", "Permits and approvals", "Equipment delivery", "Installation work", "Inspection and testing", "Commissioning", "Customer handover"];

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 1280]) {
    test(`the tracking section lists the eight steps with statuses at ${width} px in the ${theme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const section = page.locator("[data-tracking-section]");
      await section.scrollIntoViewIfNeeded();
      const steps = section.getByRole("list", { name: "Installation steps" }).getByRole("listitem");
      await expect(steps).toHaveCount(8);
      for (let i = 0; i < 8; i++) await expect(steps.nth(i)).toContainText(KINDS[i]!);
      await expect(section.getByText("3 of 8 steps complete")).toBeVisible();
      await expect(section.getByText("Sample progress")).toBeVisible();
      // Status is carried by words as well as icons.
      await expect(steps.nth(0)).toContainText("Completed");
      await expect(steps.nth(3)).toContainText("In progress");
      await expect(steps.nth(7)).toContainText("Not started");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-tracking-section]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await section.screenshot({ path: `e2e/.tmp/tracking-${theme}-${width}.png` });
    });
  }
}

test("the Track card on the feature grid jumps to this section", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.locator('[data-feature="track"]').getByRole("link", { name: "See the steps" }).click();
  await expect(page).toHaveURL(/#tracking$/);
  await expect(page.locator("#tracking")).toBeInViewport();
});
