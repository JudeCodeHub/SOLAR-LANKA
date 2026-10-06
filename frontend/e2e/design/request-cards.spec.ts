import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

const STATES = [
  ["sent", "Sent", "1 of 2 companies have opened your request."],
  ["responding", "Preparing a response", "1 company is preparing a response."],
  ["closed", "Closed", "This request is closed."],
  ["withdrawn", "Withdrawn", "You withdrew this request."],
] as const;

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`each request state has its own chip with an icon and a word, and the whole card opens the request at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-requests-sample]");
      await sample.scrollIntoViewIfNeeded();
      const cards = sample.locator("[data-request]");
      await expect(cards).toHaveCount(4);
      const looks = new Set<string>();
      for (const [index, [state, label, sentence]] of STATES.entries()) {
        const card = cards.nth(index);
        await expect(card).toHaveAttribute("data-request", state);
        const chip = card.locator("[data-chip]");
        await expect(chip).toHaveText(label);
        await expect(chip.locator("svg")).toHaveCount(1);
        await expect(card).toContainText(sentence.trim());
        looks.add(`${await chip.evaluate((element) => getComputedStyle(element).backgroundColor)}|${await chip.evaluate((element) => element.querySelector("svg")?.outerHTML.length)}`);
        const link = card.getByRole("link");
        await expect(link).toHaveAttribute("href", /^\/my\/requests\/r\d$/);
        expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
        // The link is stretched over the card, so pressing anywhere on it opens the request.
        const [box, area] = await Promise.all([card.boundingBox(), link.evaluate((element) => { const after = getComputedStyle(element, "::after"); return { position: after.position, inset: after.inset }; })]);
        expect(box?.height ?? 0).toBeGreaterThan(100);
        expect(area.position).toBe("absolute");
      }
      // Sent and preparing a response differ in colour and icon; closed and withdrawn differ in their words and icons.
      expect(looks.size).toBeGreaterThanOrEqual(3);
      await expect(cards.nth(1).locator("[data-chip]")).toHaveText("Preparing a response");
      await expect(cards.first()).toContainText("Sent to 2 companies");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-requests-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/requests-${theme}-${width}.png` });
    });
  }
}
