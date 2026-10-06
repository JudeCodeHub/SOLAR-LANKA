import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`the timeline shows all eight steps with their state, notes, delays and evidence at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-timeline-sample]");
      await sample.scrollIntoViewIfNeeded();
      const steps = sample.locator("[data-milestone]");
      await expect(steps).toHaveCount(8);
      await expect(sample.locator("[data-milestone='completed']")).toHaveCount(3);
      await expect(sample.locator("[data-milestone='in_progress']")).toHaveCount(1);
      await expect(sample.locator("[data-milestone='pending']")).toHaveCount(4);
      // Each step names itself and says its state in words; the node is decoration.
      const names = ["Site survey", "System design", "Permits and approvals", "Equipment delivery", "Installation work", "Inspection and testing", "Commissioning", "Customer handover"];
      for (const [index, name] of names.entries()) {
        await expect(steps.nth(index).getByRole("heading", { level: 3 })).toContainText(name);
        await expect(steps.nth(index).locator("[data-status]")).toBeVisible();
        await expect(steps.nth(index).locator("[data-node]")).toHaveAttribute("aria-hidden", "true");
      }
      await expect(steps.nth(0).locator("[data-status]")).toHaveText("Completed");
      await expect(steps.nth(3).locator("[data-status]")).toHaveText("In progress");
      await expect(steps.nth(7).locator("[data-status]")).toHaveText("Not started");
      // The current step carries its schedule: next action, delay, update and evidence counts.
      const current = steps.nth(3);
      await expect(current.locator("[data-next-action]")).toContainText("Confirm a delivery day");
      await expect(current.locator("[data-delay]")).toContainText("12 October 2026");
      await expect(current.locator("[data-update='status']")).toContainText("Panels shipped from the port");
      await expect(steps.nth(0).locator("[data-evidence]")).toContainText("2");
      await expect(steps.nth(7).locator("[data-no-updates]")).toBeVisible();
      // Photos are step headers on wide screens only and never block the text.
      if (width >= 768) await expect(steps.nth(0).locator("img")).toBeVisible();
      else await expect(steps.nth(0).locator("img")).toBeHidden();
      // The three kinds of node look different.
      const nodeLooks = await sample.locator("[data-node]").evaluateAll((nodes) => new Set(nodes.map((node) => `${getComputedStyle(node).backgroundColor}|${getComputedStyle(node).borderTopColor}|${node.querySelector("svg") ? 1 : 0}`)).size);
      expect(nodeLooks).toBeGreaterThanOrEqual(3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-timeline-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/timeline-${theme}-${width}.png` });
    });
  }
}
