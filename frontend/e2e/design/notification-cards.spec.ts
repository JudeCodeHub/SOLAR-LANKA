import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`unread and read notifications look different, say so in words and flip with one button at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-notifications-sample]");
      await sample.scrollIntoViewIfNeeded();
      const cards = sample.locator("[data-notification]");
      await expect(cards).toHaveCount(3);
      await expect(sample.locator("[data-notification='unread']")).toHaveCount(2);
      await expect(sample.locator("[data-notification='read']")).toHaveCount(1);
      // Unread: the word, a different background and a bar; read: the word and a quiet card.
      await expect(cards.nth(0).locator("[data-badge]")).toHaveText("Unread");
      await expect(cards.nth(2).locator("[data-badge]")).toHaveText("Read");
      const look = (index: number) => cards.nth(index).evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, shadow: getComputedStyle(element).boxShadow }));
      const [unread, read] = [await look(0), await look(2)];
      expect(unread.background).not.toBe(read.background);
      expect(unread.shadow).not.toBe(read.shadow);
      // Each card has its link and its own button, both at 44 px.
      for (const card of await cards.all()) {
        for (const control of await card.locator("a, button").all()) expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      await expect(cards.nth(0).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/my/requests/n1");
      await expect(cards.nth(0).locator("[data-action='mark-read']")).toHaveText("Mark as read");
      await expect(cards.nth(2).locator("[data-action='mark-unread']")).toHaveText("Mark as unread");
      // Marking one read changes its look and its word; marking it unread again undoes that.
      await cards.nth(0).locator("[data-action='mark-read']").click();
      await expect(sample.locator("[data-notification='unread']")).toHaveCount(1);
      await expect(cards.nth(0).locator("[data-badge]")).toHaveText("Read");
      await cards.nth(0).locator("[data-action='mark-unread']").click();
      await expect(sample.locator("[data-notification='unread']")).toHaveCount(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-notifications-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/notifications-${theme}-${width}.png` });
    });
  }
}
