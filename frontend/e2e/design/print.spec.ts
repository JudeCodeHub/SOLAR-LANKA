import { expect, test } from "@playwright/test";

test("printing a page hides the chrome and shows black text on white", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", media: "print", reducedMotion: "reduce" });
  await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
  await expect(page.locator("header[data-print-hide]")).toBeHidden();
  await expect(page.locator("footer[data-print-hide]")).toBeHidden();
  await expect(page.locator("[data-skip-link]")).toBeHidden();
  expect(await page.locator("button:visible").count()).toBe(0);
  const colours = await page.evaluate(() => ({ body: getComputedStyle(document.body).backgroundColor, text: getComputedStyle(document.querySelector("main h1, main h2") as Element).color }));
  expect(colours).toEqual({ body: "rgb(255, 255, 255)", text: "rgb(0, 0, 0)" });
  await page.emulateMedia({ media: "screen", colorScheme: "light" });
  await expect(page.locator("header[data-print-hide]")).toBeVisible();
});
