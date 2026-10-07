import { expect, test } from "@playwright/test";

const base = process.env.DESIGN_URL ?? "";

for (const path of ["/", "/design"]) {
  test(`nothing keeps animating when reduced motion is on (${path})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${base}${path}`);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(600);
    // Anything still running now would be an endless loop: nothing may be left running, and nothing may be set to repeat.
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").map((a) => `${(a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? "script"} on ${(a.effect as KeyframeEffect | null)?.target?.tagName ?? "?"}`));
    expect(running).toEqual([]);
    const looping = await page.evaluate(() => [...document.querySelectorAll("*")].filter((element) => {
      const style = getComputedStyle(element);
      return style.animationName !== "none" && style.animationIterationCount === "infinite";
    }).map((element) => element.tagName));
    expect(looping).toEqual([]);
    // Content is visible without waiting for any entrance.
    const hidden = await page.evaluate(() => [...document.querySelectorAll("[data-in-view]")].filter((element) => getComputedStyle(element).opacity === "0").length);
    expect(hidden).toBe(0);
  });
}

test("the scroll-reveal and count-up show their final state at once under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${base}/`);
  await expect(page.getByText("7,300").first()).toBeVisible();
});
