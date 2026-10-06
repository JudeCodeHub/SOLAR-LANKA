import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`both notification switches are large, labelled, work from the keyboard and report a saved status at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-settings-sample]");
      await sample.scrollIntoViewIfNeeded();
      const switches = sample.getByRole("switch");
      await expect(switches).toHaveCount(2);
      for (const [index, name] of ["Reminders", "Email"].entries()) {
        const row = sample.locator("[data-setting-row]").nth(index);
        await expect(row.getByRole("switch", { name: name })).toBeVisible();
        // The whole row is the target, at least 56 px tall, and the switch itself is drawn large.
        expect((await row.locator("label").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(56);
        const box = await row.locator("input").boundingBox();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(52);
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(28);
        // Each switch is described by its help text.
        await expect(row.locator("input")).toHaveAttribute("aria-describedby", `setting-${index === 0 ? "reminders" : "email"}-help`);
      }
      // The status is always on the page for assistive technology and empty until something is saved.
      const status = sample.locator("[data-settings-status]");
      await expect(status).toHaveAttribute("role", "status");
      await expect(status).toHaveText("");
      // Keyboard: Tab to the first switch, Space turns it off, the status says saved; the row's look follows.
      const first = switches.first();
      await expect(first).toBeChecked();
      const before = await sample.locator("[data-setting-row]").first().evaluate((element) => getComputedStyle(element).backgroundColor);
      await first.focus();
      await page.keyboard.press("Space");
      await expect(first).not.toBeChecked();
      await expect(status).toHaveText("Settings saved.");
      const after = await sample.locator("[data-setting-row]").first().evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(after).not.toBe(before);
      // Clicking the label text also toggles, and the second switch is independent.
      await sample.locator("[data-setting-row]").nth(1).locator("label span").click();
      await expect(switches.nth(1)).not.toBeChecked();
      await expect(first).not.toBeChecked();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-settings-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/settings-${theme}-${width}.png` });
    });
  }
}
