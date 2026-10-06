import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures.ts";
import type { IdentityName } from "../identities.ts";
import { acceptedInstallation } from "../support/scenario.ts";

/** The documented sizes: small phone, phone, tablet portrait, tablet landscape, desktop. */
const SIZES = [
  { name: "320 small phone", width: 320, height: 640 },
  { name: "390 phone", width: 390, height: 844 },
  { name: "768 tablet", width: 768, height: 1024 },
  { name: "1024 tablet landscape", width: 1024, height: 768 },
  { name: "1280 desktop", width: 1280, height: 800 },
];

async function settle(page: Page) {
  await page.locator("main").first().waitFor();
  await page.waitForLoadState("networkidle");
}

/** The page never scrolls sideways, and every control that is shown is big enough to press (Clerk's own widget, whose links and logo are not ours to size, is left out). */
async function usable(page: Page, label: string, width: number) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const wide = overflow > 0 ? await page.evaluate(() => [...document.querySelectorAll("main *")].filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0, 3).map((el) => el.outerHTML.slice(0, 100))) : [];
  expect(overflow, `${label}: horizontal scroll caused by ${JSON.stringify(wide)}`).toBeLessThanOrEqual(0);
  if (width <= 768) {
    const small = await page.evaluate(() =>
      [...document.querySelectorAll("main button, main a, main input:not([type=hidden]), main select, main textarea, main summary")]
        .filter((el) => {
          // A card title link stretched over its whole card (after:inset-0) is pressed anywhere on the card.
          const box = el.getBoundingClientRect();
          const inline = [...(el.parentElement?.childNodes ?? [])].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "");
          return box.width > 0 && box.height > 0 && (box.height < 24 || box.width < 24) && !inline && !el.closest("p, li > span") && !el.closest('[class^="cl-"], [class*=" cl-"]') && !el.className.toString().includes("after:inset-0");
        })
        .map((el) => el.outerHTML.slice(0, 90)),
    );
    expect(small, `${label}: controls under 24 px`).toEqual([]);
  }
}

const PAGES: [IdentityName | null, string][] = [
  [null, "/"],
  [null, "/panels"],
  [null, "/estimator"],
  [null, "/companies"],
  [null, "/learn"],
  [null, "/learn/net-metering-and-other-schemes"],
  [null, "/troubleshooting"],
  [null, "/support"],
  ["customer", "/my"],
  ["customer", "/my/requests"],
  ["customer", "/my/requests/new"],
  ["customer", "/my/support"],
  ["customer", "/notifications"],
  ["sunbirdAdmin", "/company"],
  ["sunbirdAdmin", "/company/support"],
  ["sunbirdAdmin", "/company/inbox"],
  ["sunbirdAdmin", "/company/profile"],
  ["sunbirdTechnician", "/technician"],
  ["sunbirdTechnician", "/technician/support"],
  ["platformAdmin", "/admin/catalogue"],
  ["platformAdmin", "/admin/troubleshooting"],
  ["platformAdmin", "/admin/education"],
  ["platformAdmin", "/admin/education/new"],
  ["platformAdmin", "/admin/estimator/new"],
  ["platformAdmin", "/admin/activity"],
];

test.describe("layout at the documented sizes", () => {
  // Each of these visits up to 14 pages, and the development server compiles a page the first time it is asked for.
  test.setTimeout(180_000);
  for (const size of SIZES) {
    test(`pages fit at ${size.name}`, async ({ page, signInAs }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      for (const [who, path] of PAGES) {
        signInAs(who);
        await page.goto(path);
        await settle(page);
        await usable(page, `${size.name} ${path}`, size.width);
      }
    });

    test(`the sign-in and sign-up pages fit at ${size.name}`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.setViewportSize({ width: size.width, height: size.height });
      for (const path of ["/sign-in", "/sign-up"]) {
        await page.goto(path);
        await page.locator("[data-auth-form]").waitFor();
        await page.getByRole("textbox", { name: "Email address" }).waitFor({ timeout: 30_000 });
        await settle(page);
        await usable(page, `${size.name} ${path}`, size.width);
      }
    });

    test(`the landing page shows all eleven sections and fits at ${size.name}`, async ({ page, signInAs }) => {
      signInAs(null);
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/");
      await settle(page);
      for (const marker of ["hero", "estimate-teaser", "how-it-works", "feature-grid", "catalogue-showcase", "companies-showcase", "learning-teaser", "tracking-section", "comparison-section", "safety-section", "closing-band"]) {
        await expect(page.locator(`[data-${marker}]`), marker).toHaveCount(1);
      }
      await usable(page, `${size.name} /`, size.width);
    });

    test(`record screens fit at ${size.name}`, async ({ page, api, signInAs }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      const s = await acceptedInstallation(api);
      const visits: [IdentityName, string][] = [
        ["estimateCustomer", `/my/requests/${s.requestId}`],
        ["estimateCustomer", `/my/requests/${s.requestId}/offers/${s.quotationId}`],
        ["estimateCustomer", `/my/installations/${s.installationId}`],
        ["sunbirdAdmin", `/company/installations/${s.installationId}`],
      ];
      for (const [who, path] of visits) {
        signInAs(who);
        await page.goto(path);
        await settle(page);
        await usable(page, `${size.name} ${path}`, size.width);
      }
    });
  }

  test("the menu is a dialog on a phone and a bar on a desktop", async ({ page, signInAs }) => {
    // The menu's signed-in links come from a Clerk session, which these tests bypass, so role links are pinned by the navigation unit tests (16.10).
    signInAs(null);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/panels");
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();
    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("dialog");
    await expect(menu.getByRole("link", { name: "Companies", exact: true })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Sign in" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/panels");
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Companies", exact: true })).toBeVisible();
  });

  test("the core workflow can be finished on a phone", async ({ page, api, signInAs }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const s = await acceptedInstallation(api, "estimateCustomer");
    // A second, open offer to decide on, answered through the API.
    const open = await api("estimateCustomer", "POST", "/users/me/requests", { district: "Colombo", details: "E2E phone workflow", company_ids: [s.sunbird] }, { "Idempotency-Key": crypto.randomUUID() });
    const request = open.body as { id: string; deliveries: { id: string }[] };
    const base = `/companies/${s.sunbird}/request-deliveries/${request.deliveries[0]?.id}`;
    const q = ((await api("sunbirdAdmin", "POST", `${base}/quotations`)).body as { id: string }).id;
    await api("sunbirdAdmin", "PUT", `${base}/quotations/${q}/draft`, { lines: [{ kind: "charge", description: "Installation", quantity: "1", unit_price: "90000" }], discount_kind: "none", discount_value: "0.00", tax_rate_percent: "0", capacity_kwp: "3.000", warranty_terms: "Fictional", exclusions: "None", validity_days: 30 });
    await api("sunbirdAdmin", "POST", `${base}/quotations/${q}/send`);

    signInAs("estimateCustomer");
    await page.goto(`/my/requests/${request.id}/offers/${q}`);
    await page.getByRole("button", { name: "Decline this offer" }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Decline this offer" }).click();
    await page.getByRole("button", { name: "Yes, decline this offer" }).click();
    await expect(page.getByText(/You declined this revision/)).toBeVisible();
    await usable(page, "phone after declining", 390);
  });
});
