import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures.ts";

const summary = (slug: string, title: string, extra: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-0000000000${(slug.length % 90) + 10}`,
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
const LIST = [summary("how-rooftop-solar-works", "How rooftop solar works"), summary("understanding-your-electricity-bill", "Understanding your electricity bill", { time_sensitive: true, review_overdue: true, valid_as_of: "2026-03-01", is_sample: false }), summary("cleaning-your-panels-safely", "Cleaning your panels safely")];
const ARTICLE = {
  ...LIST[1],
  language: "en",
  reviewed_on: "2026-09-02",
  review_by: "2026-09-01",
  body: "A first paragraph.\n\nA second paragraph that is a little longer so the column has something to wrap.",
  sources: [{ title: "Fictional guide", publisher: "Demo Publisher", url: "https://example.org/guide", accessed_on: "2026-09-28" }],
  related: [LIST[0], LIST[2]],
};
const PRODUCT = { id: "00000000-0000-4000-8000-000000000010", brand: "GoodWe", model: "GW3000-DNS-30" };
const step = { source_title: "Installation manual", source_page: "42", source_url: "https://example.org/manual.pdf", verified_on: "2026-09-28", is_sample: false, code: null };
const EXACT = {
  match: "exact",
  product: PRODUCT,
  references: [
    { id: "b", title: "Burning smell from the inverter", safety_level: "hazard", hazard_warning: "A burning smell is a fire risk. Do not touch it.", steps: [], ...step },
    { id: "a", title: "Display shows a fault", safety_level: "safe_observation", hazard_warning: null, steps: ["Write down the fault name.", "Check whether the display is lit."], ...step },
  ],
  suggestions: [],
  notice: "",
};

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

async function mock(page: Page) {
  await page.route("**/education/categories", (route) => route.fulfill({ json: [{ slug: "solar-basics", name: "Solar basics", description: null, position: 1, article_count: 3 }] }));
  await page.route("**/education/articles?*", (route) => route.fulfill({ json: { items: LIST, total: 3, limit: 10, offset: 0 } }));
  await page.route("**/education/articles/understanding-your-electricity-bill", (route) => route.fulfill({ json: ARTICLE }));
  await page.route("**/troubleshooting?*", (route) => route.fulfill({ json: EXACT }));
}

/** Controls under 44 px tall, leaving out links written inside a sentence and the stretched card links (their card is the target). */
const small = (page: Page) =>
  page.locator("main").locator("button, input:not([type=radio]):not([type=checkbox]), select, textarea, summary, a:not(p a):not(li > a)").evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const box = node.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && box.height < 43.5;
      })
      .map((node) => `${node.tagName.toLowerCase()} ${(node.textContent ?? "").trim().slice(0, 30)} ${Math.round(node.getBoundingClientRect().height)}px`),
  );

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 768, 1280]) {
    test(`learn, an article with an overdue notice, troubleshooting results and support pass axe, fit and have big targets at ${width} px (${theme})`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await mock(page);
      const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      const check = async (label: string) => {
        expect(await fits(), `${label} fits`).toBe(true);
        const { violations } = await new AxeBuilder({ page }).include("main").withTags(AXE_TAGS).analyze();
        expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`), `${label} axe`).toEqual([]);
        expect(await small(page), `${label} targets`).toEqual([]);
      };

      await page.goto("/learn");
      await page.locator("[data-article]").first().waitFor();
      await check("the learn list");
      await page.goto("/learn?search=bill");
      await page.locator("[data-article]").first().waitFor();
      await check("a search on the learn list");

      await page.goto("/learn/understanding-your-electricity-bill");
      await page.locator("[data-currency='overdue']").waitFor();
      await check("an article with an overdue notice");

      await page.goto("/troubleshooting");
      await check("the lookup form");
      await page.getByLabel("Your model").fill("GW3000-DNS-30");
      await page.getByRole("button", { name: "Look up" }).click();
      await page.locator("[data-result='exact']").waitFor();
      await check("the troubleshooting results");

      await page.goto("/support");
      await page.locator("[data-safety-first]").waitFor();
      await check("the support page");
      if (process.env.HERO_SHOTS) await page.screenshot({ path: `e2e/.tmp/help-${theme}-${width}.png`, fullPage: true });
    });
  }
}
