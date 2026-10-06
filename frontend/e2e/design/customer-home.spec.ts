import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`the customer home parts: greeting with a photo, next steps and three summary cards that link on at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-dashboard-sample]");
      await sample.scrollIntoViewIfNeeded();
      const header = sample.locator("[data-home-header]");
      await expect(header.getByRole("heading", { level: 1, name: "Your dashboard" })).toBeVisible();
      await expect(header.getByText("Welcome back")).toBeVisible();
      const image = header.locator("img");
      await expect(image).toBeVisible();
      const [text, photo] = await Promise.all([header.getByRole("heading", { level: 1 }).boundingBox(), image.boundingBox()]);
      // The words never sit on the picture: beside it on a wide screen, below it on a phone.
      if (width >= 1024) expect(text && photo && text.x + text.width <= photo.x + 1).toBe(true);
      else expect(text && photo && text.y >= photo.y + photo.height - 1).toBe(true);
      const next = sample.locator("[data-next-steps] a");
      await expect(next).toHaveCount(2);
      for (const link of await next.all()) expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      const cards = sample.locator("[data-card]");
      await expect(cards).toHaveCount(3);
      for (const card of await cards.all()) {
        await expect(card.locator("[data-figure]")).toBeVisible();
        const link = card.getByRole("link");
        await expect(link).toHaveCount(1);
        expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      await expect(cards.nth(1).locator("[data-empty]")).toContainText("No open offers right now.");
      await expect(cards.nth(1).locator("[data-figure]")).toHaveText("0");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-dashboard-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/home-${theme}-${width}.png` });
    });
  }
}
