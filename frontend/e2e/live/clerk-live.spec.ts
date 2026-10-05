import { expect, test } from "@playwright/test";

/** A test user you created in your Clerk development instance, with an email containing +clerk_test (its code is always 424242). */
const EMAIL = process.env.LIVE_CLERK_EMAIL;
const PASSWORD = process.env.LIVE_CLERK_PASSWORD;
const NEW_PASSWORD = process.env.LIVE_CLERK_NEW_PASSWORD;

test("the real sign-in page is Clerk's own form with an email address and a password", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sign in", { timeout: 30_000 });
  await expect(page.getByRole("textbox", { name: "Email address" })).toBeVisible();
  await expect(page.getByPlaceholder("Enter your password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
  // The app builds no sign-in form of its own, and nothing in it is a Solar Lanka password field.
  await expect(page.locator("main form")).toHaveCount(1);
});

test.describe("with a test user from your own Clerk instance", () => {
  test.skip(!EMAIL || !PASSWORD, "set LIVE_CLERK_EMAIL and LIVE_CLERK_PASSWORD to run the sign-in checks");

  test("the user signs in with a password and is shown as signed in", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("textbox", { name: "Email address" }).fill(EMAIL ?? "");
    await page.getByPlaceholder("Enter your password").fill(PASSWORD ?? "");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);
  });

  test("Forgot password sends a code and a new password can be set", async ({ page }) => {
    test.skip(!EMAIL?.includes("+clerk_test") || !NEW_PASSWORD, "needs a +clerk_test email and LIVE_CLERK_NEW_PASSWORD (this test changes the password)");
    await page.goto("/sign-in");
    await page.getByRole("textbox", { name: "Email address" }).fill(EMAIL ?? "");
    await page.getByPlaceholder("Enter your password").click();
    // If this link is missing, password recovery is not switched on in the Clerk instance.
    await page.getByRole("link", { name: /forgot password/i }).click({ timeout: 15_000 });
    await page.getByRole("button", { name: /reset your password/i }).click();
    await page.locator("input[name='code']").fill("424242");
    await page.locator("input[name='password']").first().fill(NEW_PASSWORD ?? "");
    await page.locator("input[name='confirmPassword']").fill(NEW_PASSWORD ?? "");
    await page.getByRole("button", { name: /reset password/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);
  });
});
