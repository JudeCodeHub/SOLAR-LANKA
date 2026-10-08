import { expect, test } from "@playwright/test";

test("the landing page has no second row of page links under its floating header, but other pages do", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.locator("[data-hero]").waitFor();
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  // The header itself still has the logo and the sign-in actions.
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
  await page.goto("/design");
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
});
