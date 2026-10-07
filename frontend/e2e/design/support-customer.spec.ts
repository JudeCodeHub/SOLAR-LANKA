import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`the support screens put safety first, show each case's status and keep the unsafe box and its warning at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-support-sample]");
      await sample.scrollIntoViewIfNeeded();
      // The safety card is red with a thick border and comes before the cases.
      const safety = sample.locator("[data-safety]");
      await expect(safety).toContainText("If it may be dangerous");
      await expect(safety).toContainText("do not touch the equipment");
      expect(await safety.evaluate((element) => parseFloat(getComputedStyle(element).borderTopWidth))).toBeGreaterThanOrEqual(2);
      const order = await sample.evaluate((root) => [root.querySelector("[data-safety]")!.getBoundingClientRect().top, root.querySelector("[data-cases]")!.getBoundingClientRect().top]);
      expect(order[0]).toBeLessThan(order[1]!);
      // Each case: its own status word, one icon, a stretched 44 px link; only the unsafe one has the danger chip.
      const cases = sample.locator("[data-cases] [data-case]");
      await expect(cases).toHaveCount(4);
      const words = ["Open", "Being looked at", "Resolved", "Closed"];
      for (const [index, word] of words.entries()) {
        await expect(cases.nth(index).locator("[data-case-status]")).toHaveText(word);
        await expect(cases.nth(index).locator("[data-case-status] svg")).toHaveCount(1);
        const link = cases.nth(index).getByRole("link");
        await expect(link).toHaveAttribute("href", `/my/support/s${index + 1}`);
        expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      await expect(sample.locator("[data-cases] [data-unsafe-chip]")).toHaveCount(1);
      await expect(cases.nth(1).locator("[data-unsafe-chip]")).toContainText("This may be dangerous right now");
      // The unsafe box: unticked shows no warning; ticking it shows the danger warning as an alert; unticking removes it.
      const unsafe = sample.locator("[data-unsafe-sample]");
      const box = unsafe.getByRole("checkbox", { name: "This may be dangerous right now" });
      await expect(unsafe.locator("[data-unsafe-warning]")).toHaveCount(0);
      await expect(box).not.toBeChecked();
      expect((await unsafe.locator("label").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      await box.check();
      const warning = unsafe.locator("[data-unsafe-warning]");
      await expect(warning).toBeVisible();
      await expect(warning).toHaveAttribute("role", "alert");
      await expect(warning).toContainText("call a qualified technician or the emergency services");
      expect(await warning.evaluate((element) => parseFloat(getComputedStyle(element).borderTopWidth))).toBeGreaterThanOrEqual(2);
      await box.uncheck();
      await expect(unsafe.locator("[data-unsafe-warning]")).toHaveCount(0);
      await box.check();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-support-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/support-customer-${theme}-${width}.png` });
    });
  }
}
