import { expect, test } from "@playwright/test";

test("the skip link is the first stop, obviously visible when focused, and moves focus to the content", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/design");
  await page.locator("main").first().waitFor();
  // The page fades in on first load; wait for that to finish, since clicks and hit tests land on the page root while it runs.
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((animation) => String((animation as CSSAnimation).animationName ?? "").startsWith("page-")).length)).toBe(0);
  const skip = page.getByRole("link", { name: "Skip to main content" });
  // Off screen (clipped) until it is focused.
  expect((await skip.boundingBox())?.width ?? 0).toBeLessThan(2);

  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
  const box = await skip.boundingBox();
  expect(box && box.width > 120 && box.height >= 44 && box.x >= 0 && box.y >= 0).toBe(true);
  const style = await skip.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { background: computed.backgroundColor, outline: computed.outlineStyle, outlineWidth: computed.outlineWidth };
  });
  expect(style.background).toBe("rgb(255, 106, 26)");
  expect(style.outline).toBe("solid");
  expect(parseFloat(style.outlineWidth)).toBeGreaterThanOrEqual(3);
  // It sits above the sticky header, not under it.
  const topmost = await page.evaluate(() => {
    const element = document.querySelector("[data-skip-link]")!.getBoundingClientRect();
    return document.elementFromPoint(element.x + element.width / 2, element.y + element.height / 2)?.hasAttribute("data-skip-link");
  });
  expect(topmost).toBe(true);

  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  // The next Tab goes into the page content, not back to the header.
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.closest("header[data-scrolled]") === null)).toBe(true);
});
