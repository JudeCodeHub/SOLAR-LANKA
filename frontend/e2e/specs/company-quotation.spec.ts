import { randomUUID } from "node:crypto";

import { expect, test } from "../fixtures.ts";
import { SUNBIRD } from "../identities.ts";

interface Created {
  id: string;
  deliveries: { id: string; company_id: string }[];
}
interface Offer {
  quotation_id: string;
  revision_id: string;
  status: string;
  total: string | null;
  company_id: string;
}

test.describe("a company answers an enquiry", () => {
  test("the sent offer is persisted, frozen, and visible to its customer", async ({ page, api, signInAs }) => {
    const me = (await api("sunbirdAdmin", "GET", "/users/me")).body as { memberships: { company_id: string }[] };
    const sunbird = me.memberships[0]?.company_id ?? "";
    const details = `E2E enquiry ${randomUUID()}`;

    // A customer sends a request to the company.
    const sent = await api("customer", "POST", "/users/me/requests", { district: "Colombo", details, monthly_consumption_kwh: "300", company_ids: [sunbird] }, { "Idempotency-Key": randomUUID() });
    expect(sent.status).toBe(201);
    const request = sent.body as Created;
    const delivery = request.deliveries.find((d) => d.company_id === sunbird)?.id ?? "";
    const offersOf = async (who: "customer" | "otherCustomer") => api(who, "GET", `/users/me/requests/${request.id}/quotations`);

    // The company opens the enquiry and sees what the customer wrote.
    signInAs("sunbirdAdmin");
    await page.goto(`/company/inbox/${delivery}`);
    await expect(page.getByText(details)).toBeVisible();
    expect((await offersOf("customer")).body).toEqual([]);

    // It starts a draft, which the customer cannot see.
    await page.getByRole("button", { name: "Start a quotation draft" }).click();
    await page.waitForURL(/\/quotation(\?|$)/);
    await expect(page.getByText("This is a draft. The customer sees nothing until you send it.")).toBeVisible();

    await page.getByLabel("Type").first().selectOption("charge");
    await page.getByLabel("Description").first().fill("Installation and commissioning");
    await page.getByLabel("Quantity").first().fill("1");
    await page.getByLabel("Unit price (LKR)").first().fill("120000");
    await page.getByLabel("System capacity (kWp)").fill("3");
    await page.getByLabel("Warranty terms").fill("Fictional 10 year workmanship warranty");
    await page.getByLabel("Exclusions").fill("Roof repairs");
    await page.getByLabel("Valid for (days)").fill("30");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved.")).toBeVisible();
    await expect(page.getByText("Calculated by the server").first()).toBeVisible();
    expect((await offersOf("customer")).body).toEqual([]);

    // Sending asks first, then the offer exists for the customer.
    await page.getByRole("button", { name: "Send quotation" }).click();
    await expect(page.getByText("Send this quotation?")).toBeVisible();
    await page.getByRole("button", { name: "Yes, send it" }).click();
    await expect(page.getByText(/Quotation sent\./)).toBeVisible();

    // Persisted: the customer's own API reads it, and the stored total is the server's.
    const offers = (await offersOf("customer")).body as Offer[];
    expect(offers).toHaveLength(1);
    expect(offers[0]?.status).toBe("sent");
    expect(offers[0]?.company_id).toBe(sunbird);
    const total = offers[0]?.total ?? "";
    expect(Number(total)).toBeGreaterThan(0);

    // Frozen: after a reload the same page offers no inputs for the sent content.
    await page.reload();
    await expect(page.getByText(/Sent, visible to the customer/).first()).toBeVisible();
    await expect(page.getByLabel("Unit price (LKR)")).toHaveCount(0);

    // Visible to the customer in the browser, with the same total.
    signInAs("customer");
    await page.goto(`/my/requests/${request.id}`);
    await expect(page.getByText(`Offer from ${SUNBIRD}`)).toBeVisible();
    await page.goto(`/my/requests/${request.id}/offers/${offers[0]?.quotation_id}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(SUNBIRD);
    await expect(page.getByText("Installation and commissioning")).toBeVisible();
    await expect(page.getByText(Number(total).toLocaleString("en-LK", { minimumFractionDigits: 2 })).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept this offer" })).toBeVisible();
  });

  test("other people cannot read the enquiry or the offer", async ({ api }) => {
    const me = (await api("sunbirdAdmin", "GET", "/users/me")).body as { memberships: { company_id: string }[] };
    const sunbird = me.memberships[0]?.company_id ?? "";
    const sent = await api("customer", "POST", "/users/me/requests", { district: "Colombo", details: `E2E private ${randomUUID()}`, company_ids: [sunbird] }, { "Idempotency-Key": randomUUID() });
    const request = sent.body as Created;
    const delivery = request.deliveries[0]?.id ?? "";
    expect((await api("moonleafAdmin", "GET", `/companies/${sunbird}/request-deliveries/${delivery}`)).status).toBe(403);
    expect((await api("sunbirdTechnician", "GET", `/companies/${sunbird}/request-deliveries/${delivery}`)).status).toBe(403);
    expect((await api("otherCustomer", "GET", `/users/me/requests/${request.id}/quotations`)).status).toBe(404);
  });
});
