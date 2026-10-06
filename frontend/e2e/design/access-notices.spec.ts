import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  test(`the four access notices explain what happened and what to do, and pass axe in the ${theme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/design#states");
    const group = page.locator("[data-access-notices]");
    await group.scrollIntoViewIfNeeded();
    const signedOut = group.locator('[data-access="signed-out"]');
    await expect(signedOut.getByRole("heading", { level: 2, name: "Sign in required" })).toBeVisible();
    await expect(signedOut.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", /\/sign-in/);
    await expect(signedOut.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/sign-up");
    const notAllowed = group.locator('[data-access="not-allowed"]');
    await expect(notAllowed.getByRole("heading", { name: "Not allowed" })).toBeVisible();
    await expect(notAllowed.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
    await expect(group.locator('[data-access="inactive"]').getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(group.locator('[data-access="rejected"]').getByRole("button", { name: "Sign out and sign in again" })).toBeVisible();
    // Errors announce themselves; the others do not interrupt a screen reader.
    await expect(group.locator('[data-access="inactive"]')).toHaveAttribute("role", "alert");
    await expect(group.locator('[data-access="rejected"]')).toHaveAttribute("role", "alert");
    await expect(signedOut).toHaveAttribute("role", "status");
    await expect(notAllowed).toHaveAttribute("role", "status");
    const { violations } = await new AxeBuilder({ page }).include("[data-access-notices]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    if (process.env.HERO_SHOTS) await group.screenshot({ path: `e2e/.tmp/access-${theme}.png` });
  });
}
