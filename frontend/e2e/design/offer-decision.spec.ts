import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`accepting and declining ask first, name the exact revision, total and date, and move focus to the question at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-decision-sample]");
      await sample.scrollIntoViewIfNeeded();
      const accept = sample.locator("[data-action='sample-accept']");
      const decline = sample.locator("[data-action='sample-decline']");
      for (const button of [accept, decline]) expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      await expect(sample).toContainText("Starts your installation with this company.");
      await expect(sample).toContainText("The company may still send a revised offer.");
      // Accepting: the question names the revision, the company, the total and the date, and nothing is done until yes.
      await accept.click();
      const question = sample.locator("[data-confirm='sample-accept']");
      await expect(question).toBeVisible();
      await expect(question.getByRole("heading")).toHaveText("Accept revision 2 from Sunbird Solar?");
      await expect(question.getByRole("heading")).toBeFocused();
      await expect(question).toContainText("exactly this revision for LKR 1,600,000.00, valid until 8 October 2026");
      await expect(question).toContainText("This cannot be undone.");
      const border = await question.evaluate((element) => parseFloat(getComputedStyle(element).borderTopWidth));
      expect(border).toBeGreaterThanOrEqual(2);
      for (const button of await question.getByRole("button").all()) expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      await question.getByRole("button", { name: "Not yet" }).click();
      await expect(question).toHaveCount(0);
      await expect(accept).toBeVisible();
      // Declining has its own question with its own words.
      await decline.click();
      const declineQuestion = sample.locator("[data-confirm='sample-decline']");
      await expect(declineQuestion.getByRole("heading")).toHaveText("Decline revision 2 from Sunbird Solar?");
      await expect(declineQuestion).toContainText("you can still accept other offers on this request");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-decision-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/decision-${theme}-${width}.png` });
    });
  }
}
