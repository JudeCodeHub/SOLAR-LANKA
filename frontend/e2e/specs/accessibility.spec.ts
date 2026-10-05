import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures.ts";
import type { IdentityName } from "../identities.ts";
import { acceptedInstallation } from "../support/scenario.ts";

// Each test visits several pages, and the development server compiles a page the first time it is asked for.
test.describe.configure({ timeout: 180_000 });

const RULES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function audit(page: Page, label: string) {
  await page.locator("main").first().waitFor();
  await page.waitForLoadState("networkidle");
  // The sign-in form is Clerk's own widget (its development theme has low-contrast text we do not control).
  const { violations } = await new AxeBuilder({ page }).exclude('[class*="cl-"]').withTags(RULES).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`), label).toEqual([]);
}

const PUBLIC = ["/", "/panels", "/inverters", "/estimator", "/companies", "/learn", "/learn/net-metering-and-other-schemes", "/troubleshooting", "/support", "/sign-in"];
const BY_ROLE: [IdentityName, string[]][] = [
  ["customer", ["/my", "/my/requests", "/my/estimates", "/my/installations", "/my/requests/new", "/my/support", "/notifications"]],
  ["sunbirdAdmin", ["/company", "/company/support", "/company/inbox", "/company/offers", "/company/installations", "/company/profile"]],
  ["sunbirdTechnician", ["/technician", "/technician/support"]],
  ["platformAdmin", ["/admin/companies", "/admin/catalogue", "/admin/estimator", "/admin/estimator/new", "/admin/troubleshooting", "/admin/education", "/admin/education/new", "/admin/users", "/admin/activity"]],
];

test.describe("axe finds no WCAG 2.2 AA violations", () => {
  test("public pages", async ({ page, signInAs }) => {
    signInAs(null);
    for (const path of PUBLIC) {
      await page.goto(path);
      await audit(page, path);
    }
  });
  for (const [who, paths] of BY_ROLE) {
    test(`${who} screens`, async ({ page, signInAs }) => {
      signInAs(who);
      for (const path of paths) {
        await page.goto(path);
        await audit(page, `${who} ${path}`);
      }
    });
  }
  test("record screens with real data", async ({ page, api, signInAs }) => {
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
      await audit(page, `${who} ${path}`);
    }
  });
});

test.describe("axe finds no violations on the newest screens in their changing states", () => {
  test("estimate results for each connection scheme", async ({ page, signInAs }) => {
    signInAs(null);
    await page.goto("/estimator");
    await page.getByLabel("Monthly electricity use (kWh per month)").fill("300");
    await page.getByLabel("District").selectOption({ label: "Colombo" });
    await page.getByLabel("Usable roof area (m²)").fill("30");
    await page.getByLabel("Shading on the roof").selectOption({ label: "Partial" });
    await page.getByLabel("Share of electricity used in the daytime (%)").fill("50");
    for (const scheme of ["net_metering", "net_accounting", "net_plus"]) {
      await page.getByLabel("Connection scheme").selectOption(scheme);
      await page.getByRole("button", { name: "Calculate estimate" }).click();
      await expect(page.locator("[data-scheme-note]")).toBeVisible();
      // The button dims while it is working; audit only once it has settled.
      await expect(page.getByRole("button", { name: "Calculate estimate" })).not.toHaveAttribute("aria-disabled", "true");
      await audit(page, `estimate results ${scheme}`);
    }
  });

  test("the offer page while a PDF is requested, prepared and ready, and the company quotation history", async ({ page, api, signInAs, processOutbox }) => {
    const s = await acceptedInstallation(api);
    signInAs("estimateCustomer");
    await page.goto(`/my/requests/${s.requestId}/offers/${s.quotationId}`);
    await audit(page, "offer before asking for a PDF");
    await page.locator("[data-export-request]").click();
    await expect(page.locator("[data-export-pending]")).toBeVisible();
    await audit(page, "offer while the PDF is prepared");
    processOutbox();
    await expect(page.locator("[data-export-ready]")).toBeVisible({ timeout: 15_000 });
    await audit(page, "offer with the PDF ready");

    const me = (await api("sunbirdAdmin", "GET", "/users/me")).body as { memberships: { company_id: string }[] };
    const inbox = (await api("sunbirdAdmin", "GET", `/companies/${me.memberships[0]?.company_id}/request-deliveries?limit=50`)).body as { items: { id: string; request_id: string }[] };
    const delivery = inbox.items.find((item) => item.request_id === s.requestId);
    signInAs("sunbirdAdmin");
    await page.goto(`/company/inbox/${delivery?.id}/quotation`);
    await page.locator("[data-history] summary").first().click();
    await expect(page.locator("[data-pdf-download]").first()).toBeVisible();
    await audit(page, "company quotation with its history open");
  });

  test("notification settings after a change is saved", async ({ page, api, signInAs }) => {
    signInAs("newCustomer");
    await page.goto("/notifications");
    await page.locator("[data-setting='reminders']").uncheck();
    await expect(page.locator("[data-settings-status]")).toHaveText("Settings saved.");
    await audit(page, "notification settings saved");
    await api("newCustomer", "PUT", "/users/me/notification-preferences", { reminders_enabled: true, email_enabled: true });
  });

  test("the admin estimator editor with an export scenario chosen", async ({ page, signInAs }) => {
    signInAs("platformAdmin");
    await page.goto("/admin/estimator/new");
    await page.locator("#f-scenario").selectOption("grid_net_accounting_no_backup");
    await expect(page.locator("#f-assumptions")).toContainText("export_rate_lkr_per_kwh");
    await audit(page, "admin estimator net accounting draft");
  });
});

test.describe("keyboard and focus", () => {
  test("the skip link is the first stop and moves focus to the content", async ({ page, signInAs }) => {
    signInAs(null);
    await page.goto("/panels");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("a required reason is announced and tied to its field", async ({ page, api, signInAs }) => {
    const s = await acceptedInstallation(api);
    signInAs("sunbirdAdmin");
    await page.goto(`/company/installations/${s.installationId}`);
    const form = page.locator("[data-step='in_progress']").first().locator('form[aria-labelledby$="-reset"]');
    await form.getByRole("button", { name: "Return to not started" }).focus();
    await page.keyboard.press("Enter");
    const field = form.getByLabel("Reason");
    await expect(form.locator("[data-error='reason']")).toBeVisible();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAttribute("aria-describedby", /error/);
  });

  test("a confirmation question takes focus, and Not yet closes it without acting", async ({ page, signInAs }) => {
    signInAs("platformAdmin");
    await page.goto("/admin/users");
    await page.getByLabel("Account id").fill("3f2b8c1e-0a4d-4f5e-9c7b-1d2e3f4a5b6c");
    await page.getByRole("button", { name: "Suspend this account" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-confirm='suspend'] h3")).toBeFocused();
    await page.getByRole("button", { name: "Not yet" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-confirm='suspend']")).toHaveCount(0);
    await expect(page.locator("[data-result]")).toHaveCount(0);
  });

  test("validation errors are announced and focus moves to the summary", async ({ page, signInAs }) => {
    signInAs("platformAdmin");
    await page.goto("/admin/estimator/new");
    const assumptions = page.getByLabel("Assumptions");
    await assumptions.fill("{oops");
    await page.getByRole("button", { name: /Create draft|Save draft/ }).click();
    await expect(page.locator("[data-error-summary]")).toBeFocused();
    await expect(assumptions).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("[data-error='assumptions']")).toBeVisible();
  });

  test("the account-id check on administration refuses a bad id before any question", async ({ page, signInAs }) => {
    signInAs("platformAdmin");
    await page.goto("/admin/users");
    await page.getByLabel("Account id").fill("nope");
    await page.getByRole("button", { name: "Suspend this account" }).click();
    await expect(page.locator("[data-error='id']")).toBeVisible();
    await expect(page.locator("[data-confirm='suspend']")).toHaveCount(0);
    await expect(page.getByLabel("Account id")).toHaveAttribute("aria-invalid", "true");
  });
});

test("visit screens with a confirmed visit pass axe for customer, company and technician", async ({ page, api, signInAs }) => {
  const s = await acceptedInstallation(api);
  const when = new Date(Date.now() + (3 + Math.floor(Math.random() * 80)) * 86_400_000).toISOString().slice(0, 10);
  const made = (await api("estimateCustomer", "POST", `/users/me/installations/${s.installationId}/site-visits`, { timezone: "Asia/Colombo", slots: [{ starts_at: `${when}T14:00:00+05:30`, ends_at: `${when}T16:00:00+05:30` }] })).body as { id: string; slots: { id: string }[] };
  const tech = ((await api("sunbirdAdmin", "GET", `/companies/${s.sunbird}/technicians`)).body as { user_id: string }[])[0]?.user_id;
  await api("sunbirdAdmin", "POST", `/companies/${s.sunbird}/installations/${s.installationId}/site-visits/${made.id}/confirm`, { slot_id: made.slots[0]?.id, technician_id: tech });
  const visits: [IdentityName, string][] = [
    ["estimateCustomer", `/my/installations/${s.installationId}`],
    ["sunbirdAdmin", `/company/installations/${s.installationId}`],
    ["sunbirdTechnician", `/technician/visits/${made.id}`],
  ];
  for (const [who, path] of visits) {
    signInAs(who);
    await page.goto(path);
    await audit(page, `${who} ${path}`);
  }
});

test("troubleshooting results and support cases pass axe, including the hazard box", async ({ page, api, signInAs }) => {
  signInAs(null);
  await page.goto("/troubleshooting");
  for (const [model, code] of [["GW3000-DNS-30", ""], ["GW3000-DNS", ""], ["GW3000-DNS-30", "E99"]] as const) {
    await page.getByLabel("Your model").fill(model);
    await page.getByLabel("Code shown (optional)").fill(code);
    await page.getByRole("button", { name: "Look up" }).click();
    await page.locator("[data-result]").first().waitFor();
    await audit(page, `troubleshooting ${model} ${code}`);
  }
  const s = await acceptedInstallation(api);
  const made = (await api("estimateCustomer", "POST", "/users/me/support-cases", { installation_id: s.installationId, symptom: "Display fault", observed_code: "E01", unsafe_now: true })).body as { id: string };
  const tech = ((await api("sunbirdAdmin", "GET", `/companies/${s.sunbird}/technicians`)).body as { user_id: string }[])[0]?.user_id;
  await api("sunbirdAdmin", "POST", `/companies/${s.sunbird}/support-cases/${made.id}/assignments`, { user_id: tech });
  const visits: [IdentityName, string][] = [
    ["estimateCustomer", `/my/support/${made.id}`],
    ["sunbirdAdmin", `/company/support/${made.id}`],
    ["sunbirdTechnician", `/technician/support/${made.id}`],
  ];
  for (const [who, path] of visits) {
    signInAs(who);
    await page.goto(path);
    await audit(page, `${who} ${path}`);
  }
});
