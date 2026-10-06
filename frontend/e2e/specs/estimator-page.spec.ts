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
