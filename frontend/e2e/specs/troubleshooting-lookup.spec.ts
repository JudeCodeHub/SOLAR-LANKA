import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "../fixtures.ts";

const NONE = { match: "none", product: null, references: [], suggestions: [], notice: "No published guidance for this exact model." };

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 1280]) {
    test(`the lookup page has a card form, a find-your-model aid and keeps its checks at ${width} px (${theme})`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      const asked: string[] = [];
      await page.route("**/troubleshooting?*", (route) => {
        asked.push(new URL(route.request().url()).search);
        return route.fulfill({ json: NONE });
      });
      await page.goto("/troubleshooting");
      await expect(page.getByRole("heading", { level: 1, name: "Troubleshooting" })).toBeVisible();
      const form = page.locator("[data-lookup-form]");
      await expect(form.getByLabel("Your model")).toBeVisible();
      await expect(form.getByLabel("Code shown (optional)")).toBeVisible();
      await expect(page.locator("[data-find-model]")).toContainText("Do not open the equipment");
      await expect(page.locator("[data-find-model] img")).toBeVisible();
      for (const control of [form.getByLabel("Your model"), form.getByLabel("Code shown (optional)"), form.getByRole("button", { name: "Look up" })]) expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      if (width >= 1024) {
        const [formBox, aside] = await Promise.all([form.boundingBox(), page.locator("[data-find-model]").boundingBox()]);
        expect(formBox && aside && formBox.x < aside.x, "the aid sits beside the form on a wide screen").toBe(true);
      }

      // Nothing is asked without a model: the field says so and is marked invalid.
      await form.getByRole("button", { name: "Look up" }).click();
      await expect(page.locator("[data-error='model']")).toHaveText("Enter your model first.");
      await expect(form.getByLabel("Your model")).toHaveAttribute("aria-invalid", "true");
      expect(asked).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const empty = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(empty.violations.map((v) => v.id)).toEqual([]);

      // With a model and a code, both are sent as they were typed.
      await form.getByLabel("Your model").fill("GW3000-DNS-30");
      await form.getByLabel("Code shown (optional)").fill("E12");
      await form.getByRole("button", { name: "Look up" }).click();
      await expect(page.locator("[data-result='none']")).toBeVisible();
      expect(asked).toHaveLength(1);
      expect(new URLSearchParams(asked[0]).get("model")).toBe("GW3000-DNS-30");
      expect(new URLSearchParams(asked[0]).get("code")).toBe("E12");
      const answered = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(answered.violations.map((v) => v.id)).toEqual([]);
      if (process.env.HERO_SHOTS) await page.screenshot({ path: `e2e/.tmp/trouble-${theme}-${width}.png`, fullPage: true });
    });
  }
}

const PRODUCT = { id: "00000000-0000-4000-8000-000000000010", brand: "GoodWe", model: "GW3000-DNS-30" };
const reference = (id: string, title: string, level: "hazard" | "safe_observation", extra: Record<string, unknown> = {}) => ({
  id,
  title,
  code: null,
  safety_level: level,
  hazard_warning: level === "hazard" ? "A burning smell or smoke is a fire risk. Do not touch it." : null,
  steps: level === "hazard" ? [] : ["Write down the fault name shown on the display.", "Check whether the display is lit."],
  source_title: "Installation manual",
  source_page: "42",
  source_url: "https://example.org/manual.pdf",
  verified_on: "2026-09-28",
  is_sample: false,
  ...extra,
});
const EXACT = {
  match: "exact",
  product: PRODUCT,
  // Given safe first on purpose: the page must still put the hazard first.
  references: [reference("a", "Display shows Utility Loss", "safe_observation", { code: "Utility Loss", is_sample: true }), reference("b", "Burning smell from the inverter", "hazard")],
  suggestions: [],
  notice: "",
};

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 1280]) {
    test(`the results put the hazard first with strong warning styling and no steps, then safe checks with sources at ${width} px (${theme})`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.route("**/troubleshooting?*", (route) => route.fulfill({ json: EXACT }));
      await page.goto("/troubleshooting");
      await page.getByLabel("Your model").fill("GW3000-DNS-30");
      await page.getByRole("button", { name: "Look up" }).click();
      const result = page.locator("[data-result='exact']");
      await expect(result).toBeVisible();
      const cards = result.locator("[data-reference]");
      await expect(cards).toHaveCount(2);
      await expect(cards.first()).toHaveAttribute("data-reference", "hazard");
      const hazard = cards.first();
      await expect(hazard.locator("[data-hazard]")).toContainText("Stop: this may be dangerous");
      await expect(hazard.locator("[data-hazard]")).toContainText("Do not touch it");
      await expect(hazard.locator("[data-hazard]")).toContainText("call a qualified technician");
      // A hazard shows no routine steps at all.
      await expect(hazard.locator("ol, li")).toHaveCount(0);
      expect(await hazard.evaluate((element) => parseFloat(getComputedStyle(element).borderTopWidth))).toBeGreaterThanOrEqual(2);
      const safe = cards.nth(1);
      await expect(safe.locator("[data-safe]")).toContainText("Safe things to check");
      await expect(safe.getByRole("list", { name: "Steps" }).locator("li")).toHaveCount(2);
      await expect(safe).toContainText("Code: Utility Loss");
      await expect(safe).toContainText("Sample content, written for this demonstration.");
      await expect(hazard).not.toContainText("Sample content");
      await expect(result.locator("[data-source]")).toHaveCount(2);
      await expect(result.locator("[data-source]").first()).toContainText("Source: Installation manual Page 42");
      await expect(hazard).toContainText("Checked against the source on 28 September 2026");
      const open = result.getByRole("link", { name: "Open the source" });
      await expect(open).toHaveCount(2);
      await expect(open.first()).toHaveAttribute("href", "https://example.org/manual.pdf");
      expect((await open.first().boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      const report = result.getByRole("link", { name: "Report this problem to your installer" });
      await expect(report).toHaveAttribute("href", `/my/support?product=${PRODUCT.id}`);
      expect((await report.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await result.screenshot({ path: `e2e/.tmp/results-${theme}-${width}.png` });
    });
  }
}

test("a name shared by two products asks which one and shows no instructions until one is chosen", async ({ page, signInAs }) => {
  signInAs(null);
  await page.setViewportSize({ width: 390, height: 900 });
  const asked: string[] = [];
  await page.route("**/troubleshooting?*", (route) => {
    const search = new URL(route.request().url()).search;
    asked.push(search);
    return route.fulfill({ json: search.includes("product_id") ? EXACT : { match: "ambiguous", product: null, references: [], suggestions: [PRODUCT, { ...PRODUCT, id: "00000000-0000-4000-8000-000000000011", brand: "Other" }], notice: "More than one product has that name." } });
  });
  await page.goto("/troubleshooting");
  await page.getByLabel("Your model").fill("GW3000");
  await page.getByRole("button", { name: "Look up" }).click();
  const result = page.locator("[data-result='ambiguous']");
  await expect(result).toContainText("Choose yours. Nothing is shown until you do.");
  await expect(page.locator("[data-reference]")).toHaveCount(0);
  const buttons = result.locator("[data-suggestions] button");
  await expect(buttons).toHaveCount(2);
  expect((await buttons.first().boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await buttons.first().click();
  await expect(page.locator("[data-result='exact']")).toBeVisible();
  expect(new URLSearchParams(asked.at(-1)).get("product_id")).toBe(PRODUCT.id);
});
