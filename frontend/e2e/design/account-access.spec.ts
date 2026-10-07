import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

const SELF = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`a bad or missing account id is refused before any question, and suspending yourself is refused, at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-account-sample]");
      await sample.scrollIntoViewIfNeeded();
      const input = sample.locator("#account-id");
      await expect(input).toHaveAttribute("aria-describedby", "account-id-help");
      expect((await input.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      for (const button of await sample.locator("[data-action]").all()) expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      // Nothing typed: the id is required, and no question opens.
      await sample.locator("[data-action='suspend']").click();
      await expect(sample.locator("[data-error='id']")).toBeVisible();
      await expect(sample.locator("[data-error='id'] svg")).toHaveCount(1);
      await expect(input).toHaveAttribute("aria-invalid", "true");
      await expect(input).toHaveAttribute("aria-describedby", "account-id-help account-id-error");
      await expect(sample.locator("[data-confirm]")).toHaveCount(0);
      // A malformed id: refused with its own message, for both actions, and still no question.
      await input.fill("not-an-id");
      await sample.locator("[data-action='restore']").click();
      await expect(sample.locator("[data-error='id']")).toBeVisible();
      await expect(sample.locator("[data-confirm]")).toHaveCount(0);
      // Your own id cannot be suspended: refused before the question; restoring your own id is allowed to ask.
      await input.fill(SELF);
      await sample.locator("[data-action='suspend']").click();
      await expect(sample.locator("[data-error='id']")).toBeVisible();
      await expect(sample.locator("[data-confirm]")).toHaveCount(0);
      // A good id of someone else opens the question, naming a short form of the id, with focus on it, and "Not yet" closes it.
      await input.fill(OTHER);
      await expect(sample.locator("[data-error='id']")).toHaveCount(0);
      await sample.locator("[data-action='suspend']").click();
      const question = sample.locator("[data-confirm='suspend']");
      await expect(question).toBeVisible();
      await expect(question.getByRole("heading")).toBeFocused();
      await expect(question).toContainText("22222222");
      await question.getByRole("button", { name: /Not yet|Keep/ }).first().click();
      await expect(question).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-account-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/account-${theme}-${width}.png` });
    });
  }
}
