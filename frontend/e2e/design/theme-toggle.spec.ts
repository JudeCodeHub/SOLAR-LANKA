import { expect, test, type Page } from "@playwright/test";

const html = (page: Page) => page.locator("html");

test("the theme toggle works from the keyboard, remembers its choice and follows the device when asked", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/design");
  await page.locator("main").first().waitFor();
  const group = page.getByRole("group", { name: "Colour theme" }).first();
  const dark = group.getByRole("button", { name: "Dark theme" });
  const light = group.getByRole("button", { name: "Light theme" });
  const system = group.getByRole("button", { name: "Match my device" });
  await expect(system).toHaveAttribute("aria-pressed", "true");

  // Keyboard only: focus the button, press Enter, then Space.
  await dark.focus();
  await page.keyboard.press("Enter");
  await expect(html(page)).toHaveClass(/dark/);
  await expect(dark).toHaveAttribute("aria-pressed", "true");
  await expect(system).toHaveAttribute("aria-pressed", "false");

  // The choice is applied before the page paints after a reload, even though the device says light.
  await page.reload();
  await expect(html(page)).toHaveClass(/dark/);
  await expect(html(page)).toHaveAttribute("data-theme", "dark");

  await light.focus();
  await page.keyboard.press("Space");
  await expect(html(page)).not.toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect(html(page)).toHaveAttribute("data-theme", "light");

  // "Match my device" follows the device, live.
  await system.focus();
  await page.keyboard.press("Enter");
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html(page)).toHaveAttribute("data-theme", "light");
});
