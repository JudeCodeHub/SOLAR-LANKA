import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "../fixtures.ts";

for (const kind of ["panels", "inverters"] as const) {
  for (const theme of ["light", "dark"] as const) {
    for (const width of [320, 1280]) {
      test(`a ${kind.slice(0, -1)} page keeps every section and fits at ${width} px (${theme})`, async ({ page, signInAs }) => {
        signInAs(null);
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${kind}`);
        await page.locator("[data-product] h3 a").first().click();
        const detail = page.locator("[data-product-detail]");
        await detail.waitFor();
        await expect(detail.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(detail.getByRole("img").first()).toBeVisible();
        await expect(detail.getByText("Sample catalogue entry").first()).toBeVisible();
        // Every section that was there before is still there.
        for (const heading of ["Specifications", "Source", "Documents"]) await expect(detail.getByRole("heading", { level: 2, name: new RegExp(`^${heading}`) })).toBeVisible();
        await expect(detail.locator("#offers-title")).toBeVisible();
        expect(await detail.locator("table").count()).toBeGreaterThan(0);
        expect(await detail.locator("tbody tr").count()).toBeGreaterThan(3);
        // What the catalogue does not hold is labelled, never blank or zero.
        expect(await detail.locator("[data-unspecified]").count()).toBeGreaterThan(0);
        await expect(detail.getByRole("checkbox", { name: /compare/i })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const { violations } = await new AxeBuilder({ page }).include("[data-product-detail]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
        if (process.env.HERO_SHOTS && kind === "panels" && width === 1280) await page.screenshot({ path: `e2e/.tmp/detail-${theme}.png`, fullPage: true });
      });
    }
  }
}

test("an inverter page is built exactly like a panel page and shows its own specifications", async ({ page, signInAs }) => {
  signInAs(null);
  await page.setViewportSize({ width: 1280, height: 900 });
  const structure = async (kind: "panels" | "inverters") => {
    await page.goto(`/${kind}`);
    await page.locator("[data-product] h3 a").first().click();
    const detail = page.locator("[data-product-detail]");
    await detail.waitFor();
    return {
      kind: await detail.getAttribute("data-product-detail"),
      headings: await detail.getByRole("heading", { level: 2 }).allTextContents(),
      cardClasses: await detail.locator("section[aria-labelledby=specs-title] > div > div").first().getAttribute("class"),
      sourceClasses: await detail.locator("section[aria-labelledby=source-title]").getAttribute("class"),
      groups: await detail.locator("section[aria-labelledby=specs-title] h3").allTextContents(),
      title: await detail.getByRole("heading", { level: 1 }).textContent(),
    };
  };
  const panel = await structure("panels");
  const inverter = await structure("inverters");
  expect(inverter.kind).toBe("inverter");
  expect(panel.kind).toBe("panel");
  // Same sections in the same order, the same card and panel styles.
  expect(inverter.headings.map((text) => text.replace(/\s.*/, ""))).toEqual(panel.headings.map((text) => text.replace(/\s.*/, "")));
  expect(inverter.cardClasses).toBe(panel.cardClasses);
  expect(inverter.sourceClasses).toBe(panel.sourceClasses);
  // But its own groups: inverters have an AC side and panels do not.
  expect(inverter.groups.join("|")).not.toBe(panel.groups.join("|"));
  expect(inverter.title).toMatch(/GoodWe|GW/);
  if (process.env.HERO_SHOTS) await page.screenshot({ path: "e2e/.tmp/inverter-detail.png", fullPage: true });
});
