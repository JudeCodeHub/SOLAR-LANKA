import { expect, test, type Page } from "@playwright/test";

const looks = (page: Page) =>
  page.evaluate(() => {
    const read = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color, border: style.borderTopColor };
    };
    return { card: read(".cl-card"), button: read(".cl-formButtonPrimary"), input: read(".cl-formFieldInput"), title: read(".cl-headerTitle"), link: read(".cl-footerActionLink"), label: read(".cl-formFieldLabel") };
  });

test("in the dark theme Clerk's form is dark from its first paint, and it re-colours live when the theme changes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  // Record the card's colour on every frame from the moment it exists, to catch any light flash.
  await page.addInitScript(() => {
    (window as unknown as { __cardColours: string[] }).__cardColours = [];
    const watch = () => {
      const card = document.querySelector(".cl-card");
      if (card) (window as unknown as { __cardColours: string[] }).__cardColours.push(getComputedStyle(card).backgroundColor);
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
  await page.goto("/sign-in");
  await page.locator(".cl-formButtonPrimary").waitFor({ timeout: 30_000 });
  await page.waitForTimeout(500);

  const dark = await looks(page);
  // Night surface and light text; the orange button keeps its dark ink.
  expect(dark.card?.background).toBe("rgb(21, 17, 14)");
  expect(dark.card?.color).not.toBe("rgb(26, 21, 17)");
  expect(dark.button?.background).toBe("rgb(255, 106, 26)");
  expect(dark.button?.color).toBe("rgb(13, 11, 9)");
  // The field outline is the site's tested field border, not Clerk's faint one.
  const fieldBorder = await page.evaluate(() => { const probe = document.createElement("i"); probe.style.color = "var(--ds-field-border)"; document.body.append(probe); const colour = getComputedStyle(probe).color; probe.remove(); return colour; });
  expect(dark.input?.border).toBe(fieldBorder);
  expect(dark.input?.background).toBe("rgb(21, 17, 14)");
  const seen = await page.evaluate(() => [...new Set((window as unknown as { __cardColours: string[] }).__cardColours)]);
  expect(seen, "the card was never light").toEqual(["rgb(21, 17, 14)"]);
  if (process.env.HERO_SHOTS) await page.locator("[data-auth-form]").screenshot({ path: "e2e/.tmp/clerk-dark.png" });

  // Switch to the light theme with the toggle: the same widget re-colours without a reload.
  await page.getByRole("button", { name: "Light theme" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect.poll(async () => (await looks(page)).card?.background).toBe("rgb(255, 255, 255)");
  const light = await looks(page);
  expect(light.button?.color).toBe("rgb(26, 21, 17)");
  expect(light.link?.color).toBe("rgb(179, 61, 0)");
});
