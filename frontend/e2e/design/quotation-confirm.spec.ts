import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`sending, discarding and withdrawing ask first and name what will happen, and a blocked send cannot open at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-quotation-confirm-sample]");
      await sample.scrollIntoViewIfNeeded();
      for (const button of await sample.locator("[data-action]").all()) expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      // Send: names the revision, the total and the days, and moves focus to the question.
      await sample.locator("[data-action='q-send']").click();
      const send = sample.locator("[data-confirm='q-send']");
      await expect(send.getByRole("heading")).toHaveText("Send this quotation?");
      await expect(send.getByRole("heading")).toBeFocused();
      await expect(send).toContainText("revision 2 with a total of LKR 1,600,000.00");
      await expect(send).toContainText("valid for 14 days");
      await expect(send).toContainText("You cannot edit it afterwards.");
      await send.getByRole("button", { name: "Not yet" }).click();
      await expect(send).toHaveCount(0);
      // Discard: says what stays as the customer sees it.
      await sample.locator("[data-action='q-discard']").click();
      await expect(sample.locator("[data-confirm='q-discard']")).toContainText("Revision 1 stays as the customer sees it.");
      await sample.locator("[data-confirm='q-discard']").getByRole("button", { name: "Keep the draft" }).click();
      // Withdraw: names the revision and says it cannot be undone.
      await sample.locator("[data-action='q-withdraw']").click();
      await expect(sample.locator("[data-confirm='q-withdraw']")).toContainText("accept revision 2");
      await expect(sample.locator("[data-confirm='q-withdraw']")).toContainText("This cannot be undone.");
      // A blocked send does not open its question, and the reason is written next to it.
      const blocked = sample.locator("[data-action='q-send-blocked']");
      await expect(blocked).toHaveAttribute("aria-disabled", "true");
      await blocked.click({ force: true });
      await expect(sample.locator("[data-confirm='q-send-blocked']")).toHaveCount(0);
      await expect(sample.locator("[data-need-saved]")).toContainText("Save");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-quotation-confirm-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/qconfirm-${theme}-${width}.png` });
    });
  }
}
