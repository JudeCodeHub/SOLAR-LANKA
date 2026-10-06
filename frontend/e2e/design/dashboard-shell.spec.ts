import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "@playwright/test";

const LINKS = [
  ["Dashboard", "/my"],
  ["Support", "/my/support"],
  ["My estimates", "/my/estimates"],
  ["My requests", "/my/requests"],
  ["My installations", "/my/installations"],
  ["Favourites", "/my/favourites"],
] as const;

for (const theme of ["light", "dark"] as const) {
  test(`the customer side column lists every link, marks the current one and is easy to press (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
    const sample = page.locator("[data-dashboard-sample]");
    await sample.scrollIntoViewIfNeeded();
    const nav = sample.getByRole("navigation", { name: /My activity/ });
    await expect(nav).toBeVisible();
    const links = nav.getByRole("link");
    await expect(links).toHaveCount(LINKS.length);
    for (const [index, [label, href]] of LINKS.entries()) {
      await expect(links.nth(index)).toHaveText(label);
      await expect(links.nth(index)).toHaveAttribute("href", href);
      await expect(links.nth(index).locator("svg")).toHaveCount(1);
      expect((await links.nth(index).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    // Only the current page is marked, with a tint and a bar as well as the attribute.
    await expect(nav.locator("[aria-current='page']")).toHaveCount(1);
    await expect(nav.locator("[aria-current='page']")).toHaveText("My requests");
    const marked = await nav.locator("[aria-current='page']").evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, shadow: getComputedStyle(element).boxShadow }));
    const plain = await links.first().evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(marked.background).not.toBe(plain);
    expect(marked.shadow).not.toBe("none");
    const { violations } = await new AxeBuilder({ page }).include("[data-dashboard-sample]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    if (process.env.HERO_SHOTS) await sample.screenshot({ path: `e2e/.tmp/shell-${theme}.png` });
  });

  test(`on a phone the links are behind one button that opens a drawer with the same links (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(process.env.DESIGN_URL ? `${process.env.DESIGN_URL}/design` : "/design");
    const sample = page.locator("[data-dashboard-sample]");
    await sample.scrollIntoViewIfNeeded();
    await expect(sample.getByRole("navigation", { name: /My activity/ })).toBeHidden();
    const trigger = sample.getByRole("button", { name: "My activity" });
    expect((await trigger.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await trigger.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link")).toHaveCount(LINKS.length);
    await expect(drawer.locator("[aria-current='page']")).toHaveText("My requests");
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
