import { expect, test } from "@playwright/test";

test("the sign-up page shows the welcome words, reasons and the customer-only note, and Clerk's own form takes input", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/sign-up");
  const layout = page.locator("[data-auth-layout]");
  await expect(layout.getByText("Create your account").first()).toBeVisible();
  await expect(layout.getByText("Save estimates, ask companies for quotations and follow your installation.")).toBeVisible();
  await expect(layout.locator("[data-auth-points] li")).toHaveCount(3);
  await expect(layout.getByText("New accounts are customer accounts.")).toBeVisible();
  const photo = layout.locator("[data-auth-photo]").getByRole("img").first();
  await expect(photo).toBeVisible();
  // Clerk's form works: the email field takes text, and its Sign in link goes to our sign-in page.
  const email = page.getByRole("textbox", { name: "Email address" });
  await email.waitFor({ timeout: 30_000 });
  await email.fill("someone@example.com");
  await expect(email).toHaveValue("someone@example.com");
  await expect(page.locator(".cl-footerActionLink")).toHaveAttribute("href", /sign-in/);
  // Reading order: form, then the note, then the reasons.
  const [form, note, list] = await Promise.all([page.locator("[data-auth-form]").boundingBox(), layout.getByText("New accounts are customer accounts.").boundingBox(), page.locator("[data-auth-points]").boundingBox()]);
  expect(form && note && list && form.y < note.y && note.y < list.y).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (process.env.HERO_SHOTS) await page.screenshot({ path: "e2e/.tmp/signup.png", fullPage: true });
});
