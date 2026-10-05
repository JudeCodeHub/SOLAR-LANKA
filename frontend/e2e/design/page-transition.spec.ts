import { expect, test } from "@playwright/test";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`moving between pages works and breaks nothing with motion set to ${reducedMotion}`, async ({ page }) => {
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(error.message));
    await page.emulateMedia({ reducedMotion });
    await page.goto("/design");
    await page.locator("main").first().waitFor();
    await page.getByRole("contentinfo").getByRole("link", { name: "Estimator" }).click();
    await expect(page).toHaveURL(/\/estimator$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // After the transition the old page is gone and the content is fully opaque.
    await expect.poll(() => page.evaluate(() => Number(getComputedStyle(document.querySelector("main")!).opacity))).toBe(1);
    await expect.poll(() => page.evaluate(() => document.getAnimations().filter((animation) => String((animation as CSSAnimation).animationName ?? "").startsWith("page-")).length)).toBe(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/design$/);
    expect(problems).toEqual([]);
  });
}
