import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 1280]) {
    test(`status notes share one style, are announced the right way and never cover anything at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-status-sample]");
      await sample.scrollIntoViewIfNeeded();
      const notes = sample.locator("[data-slot='status-note']");
      await expect(notes).toHaveCount(4);
      // Good news and information are polite statuses; warnings and errors are urgent alerts.
      await expect(sample.locator("[data-tone='success']")).toHaveAttribute("role", "status");
      await expect(sample.locator("[data-tone='info']")).toHaveAttribute("role", "status");
      await expect(sample.locator("[data-tone='warning']")).toHaveAttribute("role", "alert");
      await expect(sample.locator("[data-tone='error']")).toHaveAttribute("role", "alert");
      // One style: the same size and weight, an icon each (hidden from screen readers), the words in the same full-strength colour.
      const styles = await notes.evaluateAll((nodes) => nodes.map((node) => `${getComputedStyle(node).fontSize}|${getComputedStyle(node).fontWeight}|${getComputedStyle(node.querySelector("span")!).color}|${node.querySelectorAll("svg[aria-hidden='true']").length}`));
      expect(new Set(styles).size).toBe(1);
      // The icons differ by tone so meaning never rests on colour alone.
      const icons = await notes.evaluateAll((nodes) => nodes.map((node) => node.querySelector("svg")?.getAttribute("class") ?? ""));
      expect(new Set(await notes.evaluateAll((nodes) => nodes.map((node) => node.querySelector("svg")?.innerHTML ?? ""))).size).toBe(4);
      expect(icons.length).toBe(4);
      // A note is part of the page flow: it does not float, so nothing is covered and nothing moves under the pointer when it appears.
      for (const note of await notes.all()) expect(await note.evaluate((element) => getComputedStyle(element).position)).toBe("static");
      const below = sample.locator("[data-below]");
      const before = (await below.boundingBox())?.y ?? 0;
      await sample.locator("[data-add-note]").click();
      await expect(sample.locator("[data-added]")).toBeVisible();
      // The note was added inside a polite live region, and it pushed the text below it down instead of covering it.
      await expect(sample.locator("[data-live-region]")).toHaveAttribute("aria-live", "polite");
      expect((await below.boundingBox())?.y ?? 0).toBeGreaterThan(before);
      const addedBox = await sample.locator("[data-added]").boundingBox();
      const belowBox = await below.boundingBox();
      expect(addedBox && belowBox && addedBox.y + addedBox.height <= belowBox.y + 1).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-status-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/status-${theme}-${width}.png` });
    });
  }
}
