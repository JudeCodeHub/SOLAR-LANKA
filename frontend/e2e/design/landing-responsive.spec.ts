import { expect, test } from "@playwright/test";

const WIDTHS = [320, 390, 768, 1024, 1280];

for (const width of WIDTHS) {
  test.describe(`landing page at ${width} px`, () => {
    test.use({ hasTouch: true, viewport: { width, height: width < 800 ? 900 : 800 } });

    test("has no sideways scroll and every control is at least 44 px", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await page.locator("[data-closing-band]").waitFor();
      await page.waitForLoadState("networkidle");
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "page scrolls sideways").toBe(true);
      // Nothing sticks out past the right edge, even inside a clipped region.
      const outside = await page.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .filter((element) => {
            const box = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            if (box.width === 0 || style.position === "fixed" || element.closest('[role="region"][tabindex="0"], [aria-hidden="true"], svg')) return false;
            return box.right > window.innerWidth + 1;
          })
          .slice(0, 5)
          .map((element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 50)}`),
      );
      expect(outside, "elements past the right edge").toEqual([]);
      const small = await page.evaluate(() =>
        [...document.querySelectorAll("a[href], button, input, select, textarea, summary, [role=button]")]
          .filter((element) => {
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            if (style.display === "none" || style.visibility === "hidden" || box.width === 0 || element.closest("[aria-hidden='true']")) return false;
            if ((element as HTMLElement).classList.contains("sr-only") || element.matches("[data-skip-link]")) return false;
            // A title link stretched over its whole card (an ::after covering the card) is as big as the card.
            const target = String((element as HTMLElement).className).includes("after:absolute") ? (element.closest("li") ?? element) : element;
            return target.getBoundingClientRect().height < 43.5;
          })
          .slice(0, 8)
          .map((element) => `${element.tagName.toLowerCase()} "${(element.textContent ?? "").trim().slice(0, 30)}" ${Math.round(element.getBoundingClientRect().height)}px`),
      );
      expect(small, "controls under 44 px").toEqual([]);
      if (process.env.HERO_SHOTS) await page.screenshot({ path: `e2e/.tmp/landing-${width}.png`, fullPage: true, animations: "disabled" });
    });
  });
}
