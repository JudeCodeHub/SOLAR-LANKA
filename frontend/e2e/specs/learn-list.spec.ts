import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures.ts";

const article = (slug: string, title: string, extra: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-0000000000${slug.length.toString().padStart(2, "0")}`,
  slug,
  title,
  summary: `A plain summary of ${title.toLowerCase()}.`,
  category_name: "Solar basics",
  category_slug: "solar-basics",
  published_at: "2026-09-01T08:00:00Z",
  valid_as_of: null,
  time_sensitive: false,
  review_overdue: false,
  is_sample: true,
  ...extra,
});
const ARTICLES = [
  article("how-rooftop-solar-works", "How rooftop solar works"),
  article("understanding-your-electricity-bill", "Understanding your electricity bill", { time_sensitive: true, valid_as_of: "2026-08-01", category_name: "Costs and tariffs", category_slug: "costs-and-tariffs" }),
  article("cleaning-your-panels-safely", "Cleaning your panels safely"),
  article("reading-a-datasheet", "Reading a datasheet", { is_sample: false }),
];

async function mock(page: Page, items: unknown[] = ARTICLES) {
  await page.route("**/education/categories", (route) => route.fulfill({ json: [{ slug: "solar-basics", name: "Solar basics", description: null, position: 1, article_count: 3 }, { slug: "costs-and-tariffs", name: "Costs and tariffs", description: null, position: 2, article_count: 1 }] }));
  await page.route("**/education/articles?*", (route) => route.fulfill({ json: { items, total: items.length, limit: 10, offset: 0 } }));
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 1280]) {
    test(`the learn list shows one featured guide, topic chips and photo cards that all fit at ${width} px (${theme})`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await mock(page);
      await page.goto("/learn");
      await expect(page.locator("[data-article]")).toHaveCount(4);
      await expect(page.locator("[data-article][data-featured]")).toHaveCount(1);
      await expect(page.locator("[data-featured]")).toHaveAttribute("data-article", "how-rooftop-solar-works");
      await expect(page.locator("[data-article='understanding-your-electricity-bill'] [data-badge='time-sensitive']")).toBeVisible();
      await expect(page.locator("[data-article='reading-a-datasheet'] [data-badge='sample']")).toHaveCount(0);
      await expect(page.locator("[data-article='how-rooftop-solar-works'] [data-badge='sample']")).toBeVisible();
      for (const link of await page.locator("[data-article] h2 a").all()) {
        const box = await link.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThan(0);
      }
      const chips = page.getByRole("navigation", { name: "Topics" }).getByRole("link");
      await expect(chips).toHaveText(["All topics", "Solar basics (3)", "Costs and tariffs (1)"]);
      await expect(chips.first()).toHaveAttribute("aria-current", "page");
      for (const chip of await chips.all()) expect((await chip.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await page.screenshot({ path: `e2e/.tmp/learn-${theme}-${width}.png`, fullPage: true });
    });
  }
}

test("search and topic links still go to the same addresses, and a search or topic view has no featured guide", async ({ page, signInAs }) => {
  signInAs(null);
  await page.setViewportSize({ width: 1280, height: 900 });
  await mock(page);
  await page.goto("/learn");
  await page.getByLabel("Search the guides").fill("inverter");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/learn\?search=inverter$/);
  await expect(page.locator("[data-featured]")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Clear search" })).toBeVisible();
  await page.getByRole("navigation", { name: "Topics" }).getByRole("link", { name: /Costs and tariffs/ }).click();
  await expect(page).toHaveURL(/\/learn\?search=inverter&category=costs-and-tariffs$/);
  await expect(page.getByRole("navigation", { name: "Topics" }).getByRole("link", { name: /Costs and tariffs/ })).toHaveAttribute("aria-current", "page");
  await page.goto("/learn?category=solar-basics");
  await expect(page.locator("[data-featured]")).toHaveCount(0);
  await page.locator("[data-article='how-rooftop-solar-works'] h2 a").click();
  await expect(page).toHaveURL(/\/learn\/how-rooftop-solar-works$/);
});

test("with no matching guides the list says so", async ({ page, signInAs }) => {
  signInAs(null);
  await mock(page, []);
  await page.goto("/learn?search=zebra");
  await expect(page.getByText("No articles match.")).toBeVisible();
});
