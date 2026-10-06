import { expect, test } from "@playwright/test";

test("Clerk's sign-in form wears the site's orange, fonts, radius and field style in the light theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/sign-in");
  const button = page.locator(".cl-formButtonPrimary");
  await button.waitFor({ timeout: 30_000 });
  const look = await page.evaluate(() => {
    const read = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color, font: style.fontFamily, radius: style.borderTopLeftRadius, border: style.borderTopColor };
    };
    return { button: read(".cl-formButtonPrimary"), input: read(".cl-formFieldInput"), title: read(".cl-headerTitle"), link: read(".cl-footerActionLink"), card: read(".cl-card") };
  });
  // The primary button is our orange with our dark ink, and fully rounded.
  expect(look.button?.background).toBe("rgb(255, 106, 26)");
  expect(look.button?.color).toBe("rgb(26, 21, 17)");
  expect(parseFloat(look.button?.radius ?? "0")).toBeGreaterThan(20);
  // Text is in the site's body font, headings in the display font, fields in our field radius.
  expect(look.input?.font).toMatch(/body/i);
  expect(look.title?.font).toMatch(/fraunces|display/i);
  expect(look.input?.radius).toBe("6px");
  // Links are the darker orange, which is readable as text on white.
  expect(look.link?.color).toBe("rgb(179, 61, 0)");
  if (process.env.HERO_SHOTS) await page.locator("[data-auth-form]").screenshot({ path: "e2e/.tmp/clerk-light.png" });
});
