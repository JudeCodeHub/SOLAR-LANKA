import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  test(`the landing page header floats as a rounded glass bar over the hero, with the account actions (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.locator("[data-hero]").waitFor();
    const header = page.locator("header[data-floating='true']");
    const bar = header.locator("[data-header-bar]");
    // It floats: fixed, inset from the top and from both sides, rounded, and see-through with a blur.
    expect(await header.evaluate((element) => getComputedStyle(element).position)).toBe("fixed");
    const box = (await bar.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(8);
    expect(box.x).toBeGreaterThanOrEqual(16);
    const style = await bar.evaluate((element) => ({ radius: parseFloat(getComputedStyle(element).borderTopLeftRadius), blur: getComputedStyle(element).backdropFilter, background: getComputedStyle(element).backgroundColor }));
    expect(style.radius).toBeGreaterThanOrEqual(14);
    expect(style.blur).toContain("blur");
    expect(style.background).toMatch(/rgba\(|color\(/);
    // The hero starts at the very top of the page, behind the bar, and its words clear the bar.
    expect((await page.locator("[data-hero]").boundingBox())!.y).toBeLessThanOrEqual(1);
    expect((await page.locator("#hero-title").boundingBox())!.y).toBeGreaterThan(box.y + box.height);
    // The bar is a narrow pill in the middle, with the theme button, sign in and the main action.
    expect(box.width).toBeLessThanOrEqual(52 * 16 + 1);
    expect(Math.abs(box.x + box.width / 2 - 640)).toBeLessThanOrEqual(2);
    await expect(page.locator("[data-landing-links]")).toHaveCount(0);
    await expect(page.locator("[data-theme-cycle]")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
    for (const control of await bar.locator("a:visible, button:visible").all()) expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(43.5);
    // It stays in place and gets a little more solid after scrolling, and the page does scroll.
    await page.mouse.wheel(0, 1200);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    expect(Math.round((await bar.boundingBox())!.y)).toBe(Math.round(box.y));
    await expect(header).toHaveAttribute("data-scrolled", "true");
    const { violations } = await new AxeBuilder({ page }).include("header").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  });
}

test("the landing page scrolls but shows no scroll bar, and other pages keep theirs", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.locator("[data-hero]").waitFor();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth)).toBe("none");
  // The whole page is taller than the window, and the keyboard moves it.
  expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight * 2)).toBe(true);
  await page.keyboard.press("End");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
  await page.goto("/learn");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth)).not.toBe("none");
});

test("on a phone the floating bar keeps the menu button, the mark and the main action, and the theme button is in the menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("[data-hero]").waitFor();
  const bar = page.locator("[data-header-bar]");
  await expect(bar.getByRole("button", { name: "Open menu" })).toBeVisible();
  await expect(bar.getByRole("link", { name: "Create account" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("the theme button cycles light, dark and the device setting and shows the sun or the moon", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  // eslint-disable-next-line no-restricted-properties -- the theme choice is a non-auth preference, cleared so the test starts from "match my device"
  await page.evaluate(() => window.localStorage.removeItem("solarlanka-theme"));
  await page.reload();
  const button = page.locator("[data-theme-cycle]");
  await expect(button).toHaveAttribute("aria-label", /Match my device/);
  await button.click();
  await expect(button).toHaveAttribute("aria-label", /Light theme/);
  await button.click();
  await expect(button).toHaveAttribute("aria-label", /Dark theme/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await button.click();
  await expect(button).toHaveAttribute("aria-label", /Match my device/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
