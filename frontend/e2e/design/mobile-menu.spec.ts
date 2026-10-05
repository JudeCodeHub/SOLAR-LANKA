import { expect, test } from "@playwright/test";

for (const width of [320, 390]) {
  test(`the mobile menu opens, traps focus, closes with Escape and fits at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/design");
    await page.locator("main").first().waitFor();
    // The header must not push the page sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const trigger = page.getByRole("button", { name: "Open menu" });
    await trigger.click();
    const menu = page.getByRole("dialog");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(menu.getByRole("group", { name: "Colour theme" })).toBeVisible();

    // Focus stays inside the open menu however many times Tab is pressed.
    for (let press = 0; press < 25; press++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);
    }
    // The menu itself fits inside the screen.
    const box = await menu.boundingBox();
    expect(box && box.x >= -1 && box.x + box.width <= width + 1).toBe(true);

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}
