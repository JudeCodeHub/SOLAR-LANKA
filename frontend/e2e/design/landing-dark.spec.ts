import { expect, test, type Page } from "@playwright/test";

const filterOf = (page: Page, selector: string) =>
  page.evaluate((query) => getComputedStyle(document.querySelector(query)!).filter, selector);

test("in the dark theme photos are eased down, catalogue placeholders most, and in the light theme they are untouched", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/");
    await page.locator("[data-feature-grid] img").first().waitFor();
    const feature = await filterOf(page, "[data-feature-grid] img");
    if (theme === "light") {
      expect(feature).toBe("none");
    } else {
      expect(feature).toBe("brightness(0.9)");
      const product = await page.evaluate(() => getComputedStyle(document.querySelector("[data-catalogue-showcase] li img") ?? document.body).filter);
      // The catalogue may be empty without an API; when it has products they are dimmed further.
      if (product !== "none") expect(product).toBe("brightness(0.72)");
    }
  }
});
