import { expect, test } from "@playwright/test";

test("the sign-in page shows the welcome words and reasons, and Clerk's own form still takes input", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/sign-in");
  const layout = page.locator("[data-auth-layout]");
  await expect(layout.getByText("Welcome back")).toBeVisible();
  await expect(layout.getByText("Sign in to see your estimates, requests and installations.")).toBeVisible();
  const points = layout.locator("[data-auth-points] li");
  await expect(points).toHaveCount(3);
  await expect(points.nth(0)).toContainText("saved estimates");
  // Clerk's form is there and works: the email field takes text and the button is pressable.
  const email = page.getByRole("textbox", { name: "Email address" });
  await email.waitFor({ timeout: 30_000 });
  await email.fill("someone@example.com");
  await expect(email).toHaveValue("someone@example.com");
  await expect(page.locator(".cl-formButtonPrimary")).toBeEnabled();
  // Reading order: the form comes before the reasons.
  const [form, list] = await Promise.all([page.locator("[data-auth-form]").boundingBox(), page.locator("[data-auth-points]").boundingBox()]);
  expect(form && list && form.y < list.y).toBe(true);
  // The Sign up link inside Clerk goes to our sign-up page.
  await expect(page.locator(".cl-footerActionLink")).toHaveAttribute("href", /sign-up/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (process.env.HERO_SHOTS) await page.screenshot({ path: "e2e/.tmp/signin.png" });
});
