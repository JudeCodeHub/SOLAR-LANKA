import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "../fixtures.ts";

const NONE = { match: "none", product: null, references: [], suggestions: [], notice: "No published guidance for this exact model." };

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 1280]) {
    test(`the lookup page has a card form, a find-your-model aid and keeps its checks at ${width} px (${theme})`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      const asked: string[] = [];
      await page.route("**/troubleshooting?*", (route) => {
        asked.push(new URL(route.request().url()).search);
        return route.fulfill({ json: NONE });
      });
      await page.goto("/troubleshooting");
      await expect(page.getByRole("heading", { level: 1, name: "Troubleshooting" })).toBeVisible();
      const form = page.locator("[data-lookup-form]");
      await expect(form.getByLabel("Your model")).toBeVisible();
      await expect(form.getByLabel("Code shown (optional)")).toBeVisible();
      await expect(page.locator("[data-find-model]")).toContainText("Do not open the equipment");
      await expect(page.locator("[data-find-model] img")).toBeVisible();
      for (const control of [form.getByLabel("Your model"), form.getByLabel("Code shown (optional)"), form.getByRole("button", { name: "Look up" })]) expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      if (width >= 1024) {
        const [formBox, aside] = await Promise.all([form.boundingBox(), page.locator("[data-find-model]").boundingBox()]);
        expect(formBox && aside && formBox.x < aside.x, "the aid sits beside the form on a wide screen").toBe(true);
      }

      // Nothing is asked without a model: the field says so and is marked invalid.
      await form.getByRole("button", { name: "Look up" }).click();
      await expect(page.locator("[data-error='model']")).toHaveText("Enter your model first.");
      await expect(form.getByLabel("Your model")).toHaveAttribute("aria-invalid", "true");
      expect(asked).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const empty = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(empty.violations.map((v) => v.id)).toEqual([]);

      // With a model and a code, both are sent as they were typed.
      await form.getByLabel("Your model").fill("GW3000-DNS-30");
      await form.getByLabel("Code shown (optional)").fill("E12");
      await form.getByRole("button", { name: "Look up" }).click();
      await expect(page.locator("[data-result='none']")).toBeVisible();
      expect(asked).toHaveLength(1);
      expect(new URLSearchParams(asked[0]).get("model")).toBe("GW3000-DNS-30");
      expect(new URLSearchParams(asked[0]).get("code")).toBe("E12");
      const answered = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(answered.violations.map((v) => v.id)).toEqual([]);
      if (process.env.HERO_SHOTS) await page.screenshot({ path: `e2e/.tmp/trouble-${theme}-${width}.png`, fullPage: true });
    });
  }
}
