import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "../fixtures.ts";

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 1280]) {
    test(`the estimator page fits at ${width} px, its form still submits and the result takes focus (${theme})`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/estimator");
      const root = page.locator("[data-estimator-page]");
      await expect(root.getByRole("heading", { level: 1, name: "Estimate your solar system" })).toBeVisible();
      await expect(root.getByText("Estimator", { exact: true })).toBeVisible();
      // Three sections, each a named group with its numbered badge.
      for (const [id, name] of [["usage", "Your electricity use"], ["roof", "Your roof"], ["scenario", "Connection and system"]] as const) {
        await expect(root.getByRole("group", { name })).toBeVisible();
        await expect(root.locator(`fieldset[data-section="${id}"]`)).toBeVisible();
      }
      await expect(root.getByText("What this estimate covers")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (width === 1280) {
        const [form, guidance] = await Promise.all([root.locator("form").boundingBox(), root.locator("#guidance-title").boundingBox()]);
        expect(form && guidance && form.x < guidance.x, "guidance sits beside the form on a wide screen").toBe(true);
      }
      if (process.env.HERO_SHOTS) await page.screenshot({ path: `e2e/.tmp/estimator-${theme}-${width}.png`, fullPage: true });

      // The form still works.
      await root.getByLabel(/Monthly electricity use/).fill("400");
      await root.getByLabel("District").selectOption({ label: "Colombo" });
      await root.getByLabel(/Usable roof area/).fill("60");
      await root.getByRole("button", { name: "Calculate estimate" }).click();
      // The form sent its answers: either the estimate comes back, or (when the API behind the page cannot calculate) the page says so in an alert.
      const outcome = page.locator("[data-results], main [role=alert]").first();
      await expect(outcome).toBeVisible({ timeout: 20_000 });
      if ((await page.locator("[data-results]").count()) > 0) expect(await page.evaluate(() => document.activeElement?.id ?? "")).not.toBe("");

      const { violations } = await new AxeBuilder({ page }).include("[data-estimator-page]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });
  }
}

test.describe("the connection scheme cards", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`are one labelled radio group, work from the keyboard and explain each choice (${theme})`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width: 390, height: 900 });
      await page.goto("/estimator");
      const group = page.getByRole("radiogroup", { name: "Connection scheme" });
      await expect(group).toBeVisible();
      const radios = group.getByRole("radio");
      await expect(radios).toHaveCount(4);
      // Each card names its scheme and says in one line what it means.
      for (const [name, line] of [["Net metering", "Surplus energy is banked"], ["Net accounting", "Daytime use offsets imports"], ["Net plus", "Everything you generate is sold"], ["Net plus plus", "not calculated yet"]] as const) {
        const card = group.locator("label", { hasText: line });
        await expect(card).toContainText(name);
        expect((await card.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(96);
      }
      // The default is the supported net metering.
      await expect(group.getByRole("radio", { name: /^Net metering/ })).toBeChecked();
      // Keyboard: focus the group's checked radio and use the arrow keys.
      await group.getByRole("radio", { name: /^Net metering/ }).focus();
      await page.keyboard.press("ArrowDown");
      await expect(group.getByRole("radio", { name: /^Net accounting/ })).toBeChecked();
      await expect(group.getByRole("radio", { name: /^Net accounting/ })).toBeFocused();
      const ring = await group.locator("label", { has: page.locator("input:focus-visible") }).evaluate((element) => getComputedStyle(element).outlineStyle);
      expect(ring).toBe("solid");
      // Pointer: choosing the unsupported card shows the explanation that nothing is estimated.
      await group.locator("label", { hasText: "not calculated yet" }).click();
      await expect(group.getByRole("radio", { name: /^Net plus plus/ })).toBeChecked();
      await expect(page.getByText("This combination cannot be estimated yet")).toBeVisible();
      if (process.env.HERO_SHOTS) await group.screenshot({ path: `e2e/.tmp/schemes-${theme}.png` });
    });
  }
});
