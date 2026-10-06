import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures.ts";

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 768, 1280]) {
    test(`the panels list fits at ${width} px, filters work and chips remove them (${theme})`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/panels");
      const list = page.locator('[data-catalogue-list="panel"]');
      await expect(list.getByRole("heading", { level: 1, name: "Solar panels" })).toBeVisible();
      await expect(list.getByRole("search")).toBeVisible();
      const cards = list.locator("ul.grid > li");
      const before = await cards.count();
      expect(before).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      // Apply a filter: the address, the results and the chip all agree.
      await list.getByLabel("Minimum power (W)").fill("420");
      await list.getByRole("button", { name: "Apply filters" }).click();
      await expect(page).toHaveURL(/min_w=420/);
      const chip = page.locator("[data-active-filters] a");
      await expect(chip).toHaveCount(1);
      await expect(chip).toContainText("420");
      const watts = await page.locator("ul.grid > li dd").allTextContents();
      for (const text of watts.filter((value) => /\d+ ?W$/.test(value.trim()))) expect(parseFloat(text)).toBeGreaterThanOrEqual(420);
      await expect(chip).toBeVisible();
      expect(await chip.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);

      // Removing the chip drops the filter again.
      await chip.click();
      await expect(page).toHaveURL(/\/panels$/);
      await expect(page.locator("[data-active-filters]")).toHaveCount(0);

      const { violations } = await new AxeBuilder({ page }).include("[data-catalogue-list]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await page.screenshot({ path: `e2e/.tmp/panels-${theme}-${width}.png`, fullPage: true });
    });
  }
}

test.describe("the product card", () => {
  for (const kind of ["panels", "inverters"] as const) {
    test(`on the ${kind} list each card has a photo, a linked name, two figures, the sample label and both controls, and says Not specified where the data has no value`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.setViewportSize({ width: 390, height: 900 });
      await page.goto(`/${kind}`);
      const cards = page.locator("[data-product]");
      expect(await cards.count()).toBeGreaterThan(0);
      for (let index = 0; index < Math.min(await cards.count(), 3); index++) {
        const card = cards.nth(index);
        await expect(card.getByRole("img").first()).toBeVisible();
        await expect(card.getByRole("heading", { level: 3 }).getByRole("link")).toHaveAttribute("href", new RegExp(`^/${kind}/`));
        expect(await card.locator("dd").count()).toBe(2);
        await expect(card.getByText("Sample catalogue entry")).toBeVisible();
        await expect(card.getByRole("checkbox", { name: /compare/i })).toBeVisible();
        // Signed out it is a link to sign in; signed in it is a toggle button.
        const favourite = card.getByRole("link", { name: /to favourites/i }).or(card.getByRole("button", { name: /to favourites/i }));
        await expect(favourite).toBeVisible();
        const size = await favourite.evaluate((element) => { const box = element.getBoundingClientRect(); return Math.min(box.width, box.height); });
        expect(size, "favourite control size").toBeGreaterThanOrEqual(44);
      }
      if (process.env.HERO_SHOTS) await page.screenshot({ path: `e2e/.tmp/cards-${kind}.png` });
      // Whatever has no value in the catalogue says so, and nothing shows a bare zero.
      const figures = await page.locator("[data-product] dd").allTextContents();
      expect(figures.some((text) => text.trim() === "Not specified")).toBe(true);
      expect(figures.every((text) => text.trim() !== "0" && text.trim() !== "0 W" && text.trim() !== "0 kW")).toBe(true);
    });
  }
});

test.describe("the inverters list matches the panels list", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const width of [320, 1280]) {
      test(`filters, chips and cards work at ${width} px (${theme})`, async ({ page, signInAs }) => {
        signInAs(null);
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/inverters");
        const list = page.locator('[data-catalogue-list="inverter"]');
        await expect(list.getByRole("heading", { level: 1, name: "Inverters" })).toBeVisible();
        await expect(list.getByText("Catalogue", { exact: true })).toBeVisible();
        await expect(list.getByRole("search")).toBeVisible();
        expect(await list.locator("[data-product]").count()).toBeGreaterThan(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

        // The type filter, the capacity filters and the chips that remove them.
        await list.getByLabel("Type").selectOption("hybrid");
        await list.getByLabel("Minimum capacity (kW)").fill("5");
        await list.getByRole("button", { name: "Apply filters" }).click();
        await expect(page).toHaveURL(/type=hybrid/);
        await expect(page).toHaveURL(/min_kw=5/);
        const chips = page.locator("[data-active-filters] a");
        await expect(chips).toHaveCount(2);
        await expect(page.locator("[data-active-filters]")).toContainText("Hybrid");
        const types = await page.locator("[data-product] dd").allTextContents();
        expect(types.filter((text) => ["On-grid", "Off-grid"].includes(text.trim()))).toEqual([]);
        await chips.first().click();
        await expect(page.locator("[data-active-filters] a")).toHaveCount(1);
        // The form follows the address: the removed filter is cleared from its field, the other still shows.
        await expect(list.getByLabel("Type")).toHaveValue("");
        await expect(list.getByLabel("Minimum capacity (kW)")).toHaveValue("5");
        await page.locator("[data-active-filters] a").first().click();
        await expect(page).toHaveURL(/\/inverters$/);
        await expect(list.getByLabel("Type")).toHaveValue("");
        await expect(list.getByLabel("Minimum capacity (kW)")).toHaveValue("");
        if (process.env.HERO_SHOTS && width === 1280) await page.screenshot({ path: `e2e/.tmp/inverters-${theme}.png` });
      });
    }
  }
});

test.describe("the compare tray", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`appears when two panels are ticked, with 44 px controls and a link to compare (${theme})`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width: 390, height: 900 });
      await page.goto("/panels");
      await expect(page.locator("[data-compare-tray]")).toHaveCount(0);
      const boxes = page.locator("[data-product]").getByRole("checkbox", { name: /compare/i });
      await boxes.nth(0).check();
      const tray = page.locator("[data-compare-tray]");
      await expect(tray).toBeVisible();
      await expect(tray.getByText(/select at least 2 to compare/i).first()).toBeVisible();
      await boxes.nth(1).check();
      const go = tray.getByRole("link", { name: "Compare now" });
      await expect(go).toBeVisible();
      await expect(go).toHaveAttribute("href", /\/panels\/compare\?ids=/);
      for (const control of [go, ...(await tray.getByRole("button").all())]) {
        const height = await control.evaluate((element) => element.getBoundingClientRect().height);
        expect(height).toBeGreaterThanOrEqual(43.5);
      }
      expect(await tray.getByRole("button", { name: /^Remove / }).count()).toBe(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (process.env.HERO_SHOTS) await page.screenshot({ path: `e2e/.tmp/tray-${theme}.png` });
      // Removing one from the tray unticks it in the list.
      await tray.getByRole("button", { name: /^Remove / }).first().click();
      await expect(tray.getByRole("button", { name: /^Remove / })).toHaveCount(1);
    });
  }
});
