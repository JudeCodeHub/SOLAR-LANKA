import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "../fixtures.ts";
import { BACKEND_DIR } from "../support/paths.ts";
import { acceptedInstallation, sentOffer } from "../support/scenario.ts";

/** The messages the local mail sink holds for one person, by subject. */
function mailFor(subject: string, who: string): number {
  const directory = join(BACKEND_DIR, "storage", "mail");
  let files: string[] = [];
  try {
    files = readdirSync(directory);
  } catch {
    return 0;
  }
  return files.filter((name) => {
    const message = JSON.parse(readFileSync(join(directory, name), "utf8")) as { to: string; subject: string };
    return message.to === `${who}@example.test` && message.subject === subject;
  }).length;
}

const inputs = {
  monthly_consumption_kwh: "300",
  district: "Colombo",
  usable_roof_area_m2: "30",
  shading_condition: "partial",
  daytime_consumption_percent: "50",
  system_type: "on_grid",
  backup_required: false,
};

interface Estimate {
  scenario: string;
  config_version: number;
  sizing: { average_monthly_generation_kwh: { minimum: string; maximum: string } };
  financial: { monthly_savings_lkr: { minimum: string; maximum: string } | null };
  sources: Record<string, { effective_from?: string }>;
}

test.describe("phase 2 workflows run beside the core release", () => {
  test("each supported connection scheme has its own seeded, sourced configuration", async ({ api }) => {
    const preview = async (scheme: string) => {
      const result = await api("estimateCustomer", "POST", "/estimates/preview", { ...inputs, connection_scheme: scheme });
      expect(result.status).toBe(200);
      return result.body as Estimate;
    };
    const metering = await preview("net_metering");
    const accounting = await preview("net_accounting");
    const plus = await preview("net_plus");
    expect([metering.scenario, accounting.scenario, plus.scenario]).toEqual(["grid_net_metering_no_backup", "grid_net_accounting_no_backup", "grid_net_plus_no_backup"]);
    expect(metering.sources.export).toBeUndefined();
    expect(accounting.sources.export?.effective_from).toBe("2026-09-28");

    // Net plus sells every generated kWh at the seeded 25 LKR/kWh, so its value is exactly generation times rate.
    const generation = Number(plus.sizing.average_monthly_generation_kwh.minimum);
    expect(Number(plus.financial.monthly_savings_lkr?.minimum)).toBeCloseTo(generation * 25, 2);
    expect(Number(accounting.financial.monthly_savings_lkr?.minimum)).toBeGreaterThan(0);

    // Net plus plus is still refused.
    expect((await api("estimateCustomer", "POST", "/estimates/preview", { ...inputs, connection_scheme: "net_plus_plus" })).status).toBe(422);
  });

  test("a saved net accounting estimate keeps its scenario and version", async ({ api }) => {
    const saved = await api("estimateCustomer", "POST", "/users/me/estimates", { ...inputs, connection_scheme: "net_accounting" });
    expect(saved.status).toBe(201);
    const estimate = (saved.body as { id: string; estimate: Estimate }).estimate;
    expect(estimate.scenario).toBe("grid_net_accounting_no_backup");
    expect(estimate.config_version).toBe(1);
  });

  test("an exported quotation is made once by the background job and only its owner can download it", async ({ api, processOutbox }) => {
    const scenario = await acceptedInstallation(api);
    const base = `/users/me/requests/${scenario.requestId}/quotations/${scenario.quotationId}/revisions/${scenario.revisionId}`;
    const first = await api("estimateCustomer", "POST", `${base}/export`);
    expect(first.status).toBe(202);
    const again = await api("estimateCustomer", "POST", `${base}/export`);
    expect((again.body as { id: string }).id).toBe((first.body as { id: string }).id);
    const id = (first.body as { id: string }).id;
    expect((await api("estimateCustomer", "GET", `/users/me/exports/${id}/file`)).status).toBe(409);

    processOutbox();
    processOutbox();
    expect(((await api("estimateCustomer", "GET", `/users/me/exports/${id}`)).body as { status: string }).status).toBe("ready");
    const file = await api("estimateCustomer", "GET", `/users/me/exports/${id}/file`);
    expect(file.status).toBe(200);
    expect(file.bytes?.subarray(0, 5).toString()).toBe("%PDF-");

    expect((await api("otherCustomer", "GET", `/users/me/exports/${id}`)).status).toBe(404);
    expect((await api("otherCustomer", "GET", `/users/me/exports/${id}/file`)).status).toBe(404);
    expect((await api("otherCustomer", "POST", `${base}/export`)).status).toBe(404);
  });

  test("company staff can download the exact revision they sent", async ({ api }) => {
    const scenario = await acceptedInstallation(api);
    const me = (await api("sunbirdAdmin", "GET", "/users/me")).body as { memberships: { company_id: string }[] };
    const requests = await api("sunbirdAdmin", "GET", `/companies/${me.memberships[0]?.company_id}/request-deliveries?limit=50`);
    expect(requests.status).toBe(200);
    const delivery = ((requests.body as { items: { id: string; request_id: string }[] }).items).find((item) => item.request_id === scenario.requestId);
    expect(delivery).toBeDefined();
    const pdf = await api("sunbirdAdmin", "GET", `/companies/${scenario.sunbird}/request-deliveries/${delivery?.id}/quotations/${scenario.quotationId}/revisions/${scenario.revisionId}/pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.bytes?.subarray(0, 5).toString()).toBe("%PDF-");
    expect((await api("otherCustomer", "GET", `/companies/${scenario.sunbird}/request-deliveries/${delivery?.id}/quotations/${scenario.quotationId}/revisions/${scenario.revisionId}/pdf`)).status).toBeGreaterThanOrEqual(403);
  });

  test("the customer asks for a PDF on the offer page, waits while it is prepared, then downloads it", async ({ page, api, signInAs, processOutbox }) => {
    const scenario = await acceptedInstallation(api);
    signInAs("estimateCustomer");
    await page.goto(`/my/requests/${scenario.requestId}/offers/${scenario.quotationId}`);
    await page.locator("[data-export-request]").click();
    await expect(page.locator("[data-export-pending]")).toBeVisible();
    await expect(page.locator("[data-export-download]")).toHaveCount(0);

    // The background job runs; the page notices on its next check.
    processOutbox();
    await expect(page.locator("[data-export-ready]")).toBeVisible({ timeout: 15_000 });
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-export-download]").click()]);
    expect(download.suggestedFilename()).toBe("quotation-r1.pdf");
  });

  test("company staff download a sent revision from the quotation page", async ({ page, api, signInAs }) => {
    const scenario = await acceptedInstallation(api);
    const me = (await api("sunbirdAdmin", "GET", "/users/me")).body as { memberships: { company_id: string }[] };
    const inbox = await api("sunbirdAdmin", "GET", `/companies/${me.memberships[0]?.company_id}/request-deliveries?limit=50`);
    const delivery = ((inbox.body as { items: { id: string; request_id: string }[] }).items).find((item) => item.request_id === scenario.requestId);
    signInAs("sunbirdAdmin");
    await page.goto(`/company/inbox/${delivery?.id}/quotation`);
    await page.locator("[data-history] summary").first().click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-pdf-download]").first().click()]);
    expect(download.suggestedFilename()).toBe("quotation-r1.pdf");
  });

  test("the estimate form calculates net accounting and net plus, shows the feed-in source and refuses net plus plus", async ({ page, signInAs }) => {
    signInAs(null);
    await page.goto("/estimator");
    await page.getByLabel("Monthly electricity use (kWh per month)").fill("300");
    await page.getByLabel("District").selectOption({ label: "Colombo" });
    await page.getByLabel("Usable roof area (m²)").fill("30");
    await page.getByLabel("Shading on the roof").selectOption({ label: "Partial" });
    await page.getByLabel("Share of electricity used in the daytime (%)").fill("50");

    await page.getByLabel("Connection scheme").selectOption("net_accounting");
    await page.getByRole("button", { name: "Calculate estimate" }).click();
    await expect(page.getByRole("heading", { name: "Your estimate" })).toBeVisible();
    await expect(page.locator("[data-scheme-note]")).toContainText("Net accounting");
    await expect(page.locator("[data-source='export']")).toContainText("Feed-in rate for exports");

    // Changing the scheme marks the shown estimate as out of date until it is calculated again.
    await page.getByLabel("Connection scheme").selectOption("net_plus");
    await page.getByRole("button", { name: "Calculate estimate" }).click();
    await expect(page.locator("[data-scheme-note]")).toContainText("Net plus");
    await expect(page.locator("[data-source='export']")).toBeVisible();

    await page.getByLabel("Connection scheme").selectOption("net_metering");
    await page.getByRole("button", { name: "Calculate estimate" }).click();
    await expect(page.locator("[data-scheme-note]")).toContainText("Net metering");
    await expect(page.locator("[data-source='export']")).toHaveCount(0);

    // Net plus plus is explained and not sent.
    await page.getByLabel("Connection scheme").selectOption("net_plus_plus");
    await expect(page.getByText("This combination cannot be estimated yet")).toBeVisible();
    await page.getByRole("button", { name: "Calculate estimate" }).click();
    await expect(page.locator("[data-slot=field-error]").filter({ hasText: "Choose Net metering, Net accounting or Net plus" })).toBeVisible();
  });

  test("an administrator drafts a net accounting configuration that needs its dated export rate and source", async ({ page, signInAs }) => {
    signInAs("platformAdmin");
    await page.goto("/admin/estimator/new");
    await page.locator("#f-scenario").selectOption("grid_net_accounting_no_backup");
    // The draft starts from the newest net accounting version, so the export fields are already there.
    const assumptions = page.locator("#f-assumptions");
    await expect(assumptions).toContainText("export_rate_lkr_per_kwh");
    const stored = JSON.parse(await assumptions.inputValue()) as Record<string, unknown>;

    // Without the rate the form says what is missing and nothing is saved.
    const withoutRate = Object.fromEntries(Object.entries(stored).filter(([key]) => key !== "export_rate_lkr_per_kwh"));
    await assumptions.fill(JSON.stringify(withoutRate));
    await page.getByRole("button", { name: /Create draft|Save draft/ }).click();
    await expect(page.locator("[data-error='assumptions']")).toContainText("export_rate_lkr_per_kwh");
    await expect(page.locator("[data-error-summary]")).toBeFocused();

    // With the rate it is saved as a draft of that scenario and the list shows it.
    await assumptions.fill(JSON.stringify(stored));
    await page.getByRole("button", { name: /Create draft|Save draft/ }).click();
    await page.waitForURL(/\/admin\/estimator\/[0-9a-f-]{36}$/);
    await expect(page.locator("[data-scenario]")).toContainText("Net accounting");
    await expect(page.locator("span[data-status]")).toHaveText("Draft");
    await page.goto("/admin/estimator");
    await expect(page.locator("[data-version][data-status='draft'] [data-scenario]").filter({ hasText: "Net accounting" }).first()).toBeVisible();
  });

  test("a due reminder appears once however often the job runs, and opens the request", async ({ page, api, signInAs, runReminders }) => {
    const offer = await sentOffer(api);
    const remindersFor = async (who: "estimateCustomer") =>
      ((await api(who, "GET", "/users/me/notifications?limit=50")).body as { items: { kind: string; target_id: string | null }[] }).items.filter((item) => item.kind === "reminder.quotation_expiring" && item.target_id === offer.requestId);

    expect(await remindersFor("estimateCustomer")).toHaveLength(0);
    runReminders();
    runReminders();
    expect(await remindersFor("estimateCustomer")).toHaveLength(1);

    signInAs("estimateCustomer");
    await page.goto("/notifications");
    const link = page.locator(`a[href="/my/requests/${offer.requestId}"]`).first();
    await expect(link).toBeVisible();
    await expect(page.getByText("An offer is about to expire").first()).toBeVisible();
    await link.click();
    await page.waitForURL(`**/my/requests/${offer.requestId}`);
  });

  test("an offer, its acceptance and its reminder each write one email to the local sink, however often the jobs run", async ({ api, processOutbox, runReminders }) => {
    const customer = "e2e_customer_estimate";
    // Settle whatever earlier tests left pending so only this test's events are counted.
    processOutbox();
    runReminders();

    const offer = await sentOffer(api);
    const received = mailFor("You have a new offer", customer);
    processOutbox();
    processOutbox();
    expect(mailFor("You have a new offer", customer)).toBe(received + 1);

    const expiring = mailFor("An offer is about to expire", customer);
    runReminders();
    runReminders();
    expect(mailFor("An offer is about to expire", customer)).toBe(expiring + 1);

    const accepted = mailFor("Quotation accepted", customer);
    const response = await api("estimateCustomer", "POST", `/users/me/requests/${offer.requestId}/quotations/${offer.quotationId}/revisions/${offer.revisionId}/accept`);
    expect(response.status).toBeLessThan(300);
    processOutbox();
    processOutbox();
    expect(mailFor("Quotation accepted", customer)).toBe(accepted + 1);
  });
});
