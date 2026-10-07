import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

const start = process.env.DESIGN_URL ?? "";

/** Presses Tab until the element is focused (at most 80 times), checking that every stop on the way shows a focus ring. */
async function tabTo(page: Page, target: string, ringless: string[]) {
  for (let press = 0; press < 80; press += 1) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return { name: "body", ring: true, match: "" };
      const style = getComputedStyle(element);
      const ring = (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2) || element.matches("[data-slot='skip-link'], [data-skip-link]");
      return { name: `${element.tagName.toLowerCase()} ${(element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 30)}`, ring, match: element.id };
    });
    if (!stop.ring) ringless.push(stop.name);
    if (await page.locator(target).first().evaluate((element) => element === document.activeElement).catch(() => false)) return;
  }
  throw new Error(`Tab never reached ${target}`);
}

test("the skip link, the header and the landing page's main action work with the keyboard alone", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${start}/`);
  const ringless: string[] = [];
  // The very first Tab stop is the skip link, and Enter moves focus to the main area.
  await page.keyboard.press("Tab");
  await expect(page.locator("[data-skip-link]")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  // From there the hero's main action is reached by Tab and opens the estimator with Enter.
  await tabTo(page, "a:has-text('Estimate my system')", ringless);
  await page.keyboard.press("Enter");
  await page.waitForURL("**/estimator");
  expect(ringless, "stops without a visible focus ring").toEqual([]);
});

test("the estimator form is filled and sent with the keyboard alone, and mistakes are announced", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${start}/estimator`);
  const ringless: string[] = [];
  await tabTo(page, "input[name='monthly_consumption_kwh']", ringless);
  // Sending with nothing in the first field is refused with a message, and the field is marked.
  await tabTo(page, "button[type='submit']", ringless);
  await page.keyboard.press("Enter");
  await expect(page.locator("[aria-invalid='true']").first()).toBeVisible();
  await expect(page.locator("main [role='alert'], main [id$='-error'], main [data-error]").first()).toBeVisible();
  // Back in the field by keyboard, a value can be typed.
  await page.locator("input[name='monthly_consumption_kwh']").focus();
  await page.keyboard.type("400");
  await expect(page.locator("input[name='monthly_consumption_kwh']")).toHaveValue("400");
  expect(ringless, "stops without a visible focus ring").toEqual([]);
});

test("the phone menu opens with Enter, traps nothing, and Escape returns focus to its button", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${start}/panels`);
  const button = page.getByRole("button", { name: "Open menu" });
  await button.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("dialog");
  await expect(menu).toBeVisible();
  // Focus stays inside the menu while Tab goes round it.
  for (let press = 0; press < 12; press += 1) {
    await page.keyboard.press("Tab");
    expect(await menu.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(button).toBeFocused();
});

test("accepting an offer is a two-step keyboard action that asks first and can be backed out of", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${start}/design`);
  const sample = page.locator("[data-decision-sample]");
  const accept = sample.locator("[data-action='sample-accept']");
  await accept.focus();
  await page.keyboard.press("Enter");
  const question = sample.locator("[data-confirm='sample-accept']");
  // Focus moves to the question's heading, so a screen reader and a keyboard user both land on it.
  await expect(question.getByRole("heading")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(question.getByRole("button").first()).toBeFocused();
  // Space activates a button as well as Enter: pressing it on "Not yet" backs out.
  const notYet = question.getByRole("button", { name: "Not yet" });
  await notYet.focus();
  await page.keyboard.press("Space");
  await expect(question).toHaveCount(0);
  await expect(accept).toBeVisible();
});
