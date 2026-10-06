import { expect, test } from "@playwright/test";

for (const path of ["/sign-in", "/sign-up"]) {
  for (const width of [320, 390, 768, 1280]) {
    test(`${path} uses the shared layout and fits at ${width} px`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      const layout = page.locator("[data-auth-layout]");
      await layout.waitFor();
      await page.waitForLoadState("networkidle");
      await expect(page.locator("[data-auth-form]")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const sidePhoto = page.locator("[data-auth-photo]");
      if (width >= 1024) {
        await expect(sidePhoto).toBeVisible();
        await expect(sidePhoto.getByRole("img", { name: /system size: 5.4 kW/i })).toBeVisible();
        const [form, photo] = await Promise.all([page.locator("[data-auth-form]").boundingBox(), sidePhoto.boundingBox()]);
        expect(form && photo && form.x < photo.x, "form on the left, photo on the right").toBe(true);
      } else {
        await expect(sidePhoto).toBeHidden();
        // One column: the photo strip sits above the form.
        const [strip, form] = await Promise.all([layout.locator("img").first().boundingBox(), page.locator("[data-auth-form]").boundingBox()]);
        expect(strip && form && strip.y < form.y).toBe(true);
      }
      if (process.env.HERO_SHOTS) await page.screenshot({ path: `e2e/.tmp/auth${path.replace("/", "-")}-${width}.png` });
    });
  }
}
