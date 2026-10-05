import { expect, test, type Page } from "@playwright/test";

const ENTRANCE = ["hero-rise", "hero-fade", "dial-sweep"];
const running = (page: Page) =>
  page.evaluate(
    (names) => document.getAnimations().filter((animation) => animation.playState !== "finished" && names.includes(String((animation as CSSAnimation).animationName ?? ""))).length,
    ENTRANCE,
  );

test("with motion on, the hero rises in turn, the dial sweeps once, and nothing replays", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.locator("[data-hero]").waitFor();
  // Right after load the entrance is playing: the headline, the photo and the dial arc.
  expect(await running(page)).toBeGreaterThan(3);
  await expect.poll(() => running(page), { timeout: 10_000 }).toBe(0);
  const headline = page.getByRole("heading", { level: 1 });
  expect(await headline.evaluate((element) => Number(getComputedStyle(element).opacity))).toBe(1);
  // It is a one-off: scrolling and resizing do not start it again.
  await page.mouse.wheel(0, 600);
  await page.setViewportSize({ width: 900, height: 700 });
  await page.waitForTimeout(500);
  expect(await running(page)).toBe(0);
});

test("with reduced motion, the hero simply appears and nothing animates", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator("[data-hero]").waitFor();
  expect(await running(page)).toBe(0);
  for (const locator of [page.getByRole("heading", { level: 1 }), page.getByRole("link", { name: "Estimate my system" }), page.locator("[data-hero-dial]")]) {
    expect(await locator.evaluate((element) => Number(getComputedStyle(element).opacity))).toBe(1);
  }
});
