import { expect, test } from "@playwright/test";

for (const path of ["/design", "/no-such-page"]) {
  test(`the demonstration notice and footer links are visible on ${path}`, async ({ page }) => {
    await page.goto(path);
    const footer = page.getByRole("contentinfo");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.getByText("Portfolio demonstration", { exact: true })).toBeVisible();
    await expect(footer.getByText(/fictional samples/)).toBeVisible();
    await expect(footer.getByRole("link", { name: "Solar panels" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Support" })).toBeVisible();
  });
}
