import { expect, test } from "@playwright/test";

for (const path of ["/design", "/no-such-page"]) {
  test(`the footer shows its links and no demonstration banner on ${path}`, async ({ page }) => {
    await page.goto(path);
    const footer = page.getByRole("contentinfo");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.getByRole("link", { name: "Solar panels" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Support" })).toBeVisible();
    await expect(footer.getByText("Portfolio demonstration", { exact: true })).toHaveCount(0);
    await expect(footer.locator("[data-demo-notice]")).toHaveCount(0);
  });
}
