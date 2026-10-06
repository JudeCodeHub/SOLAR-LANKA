import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "../fixtures.ts";

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 1280]) {
    test(`the companies list fits at ${width} px, keeps its badges' meaning and its filters work (${theme})`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/companies");
      const root = page.locator("[data-directory]");
      await expect(root.getByRole("heading", { level: 1, name: "Solar companies" })).toBeVisible();
      await expect(root.getByText("Directory", { exact: true })).toBeVisible();
      await expect(root.getByRole("search")).toBeVisible();
      const cards = root.locator("[data-company]");
      expect(await cards.count()).toBeGreaterThan(0);
      const first = cards.first();
      await expect(first.getByRole("img").first()).toBeVisible();
      await expect(first.getByRole("heading", { level: 3 }).getByRole("link")).toHaveAttribute("href", /^\/companies\//);
      // The approval label says exactly what it always said, and a declared credential says it is not verified.
      await expect(first.getByText("Approved listing")).toBeVisible();
      const declared = root.getByText("Company declared, not verified");
      if ((await declared.count()) > 0) await expect(declared.first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      // Filter by a district: it is in the address, as a chip, and the form follows the chip being removed.
      await root.getByLabel("District").selectOption({ index: 1 });
      await root.getByRole("button", { name: "Apply filters" }).click();
      await expect(page).toHaveURL(/district=/);
      const chip = page.locator("[data-active-filters] a");
      await expect(chip).toHaveCount(1);
      await expect(chip).toBeVisible();
      expect(await chip.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      await chip.click();
      await expect(page).toHaveURL(/\/companies$/);
      await expect(root.getByLabel("District")).toHaveValue("");

      const { violations } = await new AxeBuilder({ page }).include("[data-directory]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await page.screenshot({ path: `e2e/.tmp/companies-${theme}-${width}.png` });
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 1280]) {
    test(`a company page shows who it is, what it does, where, what is checked, and how to start a request at ${width} px (${theme})`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/companies");
      const name = (await page.locator("[data-company] h3").first().textContent())?.trim() ?? "";
      await page.locator("[data-company] h3 a").first().click();
      const profile = page.locator("[data-company-profile]");
      await profile.waitFor();
      await expect(profile.getByRole("heading", { level: 1 })).toHaveText(name);
      await expect(profile.getByText("Approved listing").first()).toBeVisible();
      // Every section that was there before is still there.
      for (const heading of ["Services offered", "Districts served", "Platform approval", "Declared credentials"]) await expect(profile.getByRole("heading", { level: 2, name: heading })).toBeVisible();
      await expect(profile.getByText("Approval does not mean the company's registration, licences or qualifications have been checked.")).toBeVisible();
      // A customer can start a request from here.
      const start = profile.getByRole("link", { name: "Start a quotation request" });
      await expect(start).toHaveAttribute("href", "/my/requests/new");
      expect(await start.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      await expect(profile.getByText("choose which companies receive it, including this one")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include("[data-company-profile]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      if (process.env.HERO_SHOTS) await page.screenshot({ path: `e2e/.tmp/profile-${theme}-${width}.png`, fullPage: true });
    });
  }
}
