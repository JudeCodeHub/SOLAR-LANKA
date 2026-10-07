import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 1280]) {
    test(`the one file control is labelled, large, hands over the chosen file, and shows uploading and refused states at ${width} px (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
      const sample = page.locator("[data-file-sample]");
      await sample.scrollIntoViewIfNeeded();
      // The same control in each place: labelled, at least 48 px (56 px for the large one), describedby its help.
      const idle = sample.locator("#demo-idle");
      await expect(sample.getByLabel("Photo of the display").first()).toBeVisible();
      expect((await idle.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(47.5);
      expect((await sample.locator("#demo-large").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(55.5);
      await expect(idle).toHaveAttribute("aria-describedby", "demo-idle-help");
      await expect(idle).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
      // Choosing a file hands it over and empties the field, so the same file can be chosen again.
      await idle.setInputFiles({ name: "display.jpg", mimeType: "image/jpeg", buffer: Buffer.from("x") });
      await expect(sample.locator("[data-received]")).toHaveText("display.jpg");
      expect(await idle.evaluate((element) => (element as HTMLInputElement).value)).toBe("");
      // Uploading: the field is disabled and a turning dial with the words says so, as a polite status.
      const busy = sample.locator("[data-state='busy']");
      await expect(busy.locator("#demo-busy")).toBeDisabled();
      await expect(busy.locator("[data-uploading]")).toContainText("Uploading the photo");
      await expect(busy.locator("[data-uploading] svg")).toHaveCount(1);
      await expect(busy.locator("[data-uploading]")).toHaveAttribute("role", "status");
      // Refused: the field is marked invalid, and the message is an alert with an icon, linked to the field.
      const error = sample.locator("[data-state='error']");
      await expect(error.locator("#demo-error")).toHaveAttribute("aria-invalid", "true");
      await expect(error.locator("#demo-error")).toHaveAttribute("aria-describedby", "demo-error-help demo-error-error");
      await expect(error.locator("[data-error='photo']")).toHaveAttribute("role", "alert");
      await expect(error.locator("[data-error='photo'] svg")).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-file-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/files-${theme}-${width}.png` });
    });
  }
}
