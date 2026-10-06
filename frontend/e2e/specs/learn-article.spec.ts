import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures.ts";

const HOSTILE = 'Plain words. <script>window.__ran = true</script><b>bold</b><img src=x onerror="window.__ran = true">';
const ARTICLE = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "how-rooftop-solar-works",
  title: "How rooftop solar works",
  summary: "From sunlight on a panel to power in your home.",
  category_name: "Solar basics",
  category_slug: "solar-basics",
  language: "en",
  published_at: "2026-09-01T08:00:00Z",
  reviewed_on: "2026-09-02",
  valid_as_of: null,
  review_by: null,
  time_sensitive: false,
  review_overdue: false,
  is_sample: true,
  body: `${HOSTILE}\n\nThe second paragraph is longer and carries on for a while so the reading column has a few lines to wrap onto, which is what a real guide looks like when someone reads it on a phone or a wide screen.\n\nA third one.`,
  sources: [{ title: "Fictional guide", publisher: "Demo Publisher", url: "https://example.org/guide", accessed_on: "2026-09-28" }],
  related: [{ id: "00000000-0000-4000-8000-000000000002", slug: "reading-a-datasheet", title: "Reading a datasheet" }],
};

async function open(page: Page) {
  await page.route("**/education/articles/how-rooftop-solar-works", (route) => route.fulfill({ json: ARTICLE }));
  await page.goto("/learn/how-rooftop-solar-works");
  await page.locator("[data-article-page]").waitFor();
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 1280]) {
    test(`the article reads in a narrow column with a photo, its sources and related guides at ${width} px (${theme})`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await open(page);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("How rooftop solar works");
      await expect(page.locator("[data-article-page] img").first()).toBeVisible();
      // The text is still plain text, never markup.
      await expect(page.locator("[data-body]")).toContainText("<script>window.__ran = true</script>");
      await expect(page.locator("[data-body] b, [data-body] script, [data-body] img")).toHaveCount(0);
      expect(await page.evaluate(() => (window as unknown as { __ran?: boolean }).__ran)).toBeUndefined();
      // A comfortable line length: about 65 characters at most.
      const column = await page.locator("[data-body] p").nth(1).evaluate((element) => {
        const style = getComputedStyle(element);
        return element.getBoundingClientRect().width / parseFloat(style.fontSize);
      });
      expect(column).toBeLessThanOrEqual(46);
      expect((await page.locator("[data-sources] a").first().boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      await expect(page.locator("[data-sources] a").first()).toHaveAttribute("href", "https://example.org/guide");
      await expect(page.locator("[data-related] a")).toHaveAttribute("href", "/learn/reading-a-datasheet");
      expect((await page.locator("[data-related] a").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      // The contents list shows on wide screens only.
      if (width >= 1024) {
        const contents = page.getByRole("navigation", { name: "On this page" });
        await expect(contents).toBeVisible();
        await contents.getByRole("link", { name: "Sources" }).click();
        await expect(page).toHaveURL(/#sources-title$/);
        await expect(page.locator("#sources-title")).toBeInViewport();
      } else {
        await expect(page.locator("[data-contents]")).toBeHidden();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await page.screenshot({ path: `e2e/.tmp/article-${theme}-${width}.png`, fullPage: true });
    });
  }
}
