import { randomUUID } from "node:crypto";

import { expect, test } from "../fixtures.ts";
import { RIVAL, SUNBIRD } from "../identities.ts";

const INPUTS = { monthly_consumption_kwh: "300", district: "Colombo", usable_roof_area_m2: "30", shading_condition: "partial", daytime_consumption_percent: "50", connection_scheme: "net_metering", system_type: "on_grid", backup_required: false };

interface Offer {
  quotation_id: string;
  revision_id: string;
  status: string;
}
interface Installation {
  id: string;
  accepted_revision_id: string;
  completed_milestones: number;
  total_milestones: number;
}

test("a customer goes from an estimate to an accepted, trackable installation", async ({ page, api, signInAs }) => {
  const sunbird = ((await api("sunbirdAdmin", "GET", "/users/me")).body as { memberships: { company_id: string }[] }).memberships[0]?.company_id ?? "";

  // The development server compiles each route on first use; warming the two this test leans on avoids a cold-start timeout that says nothing about the app.
  await page.request.get("/api/public/companies?limit=1");
  await page.request.get("/api/users/me/estimates?limit=1");

  // 1. Anyone can calculate an estimate in the browser.
  signInAs(null);
  await page.goto("/estimator");
  await page.getByLabel("Monthly electricity use (kWh per month)").fill("300");
  await page.getByLabel("District").selectOption({ label: "Colombo" });
  await page.getByLabel("Usable roof area (m²)").fill("30");
  await page.getByLabel("Shading on the roof").selectOption({ label: "Partial" });
  await page.getByRole("button", { name: "Calculate estimate" }).click();
  await expect(page.getByRole("heading", { name: "Your estimate" })).toBeVisible();

  // 2. The signed-in customer keeps one. (Saving from the page needs a real Clerk session, so the same inputs are saved through the API.)
  signInAs("estimateCustomer");
  const saved = await api("estimateCustomer", "POST", "/users/me/estimates", INPUTS);
  expect(saved.status).toBe(201);
  await page.goto("/my/estimates");
  await expect(page.getByText(/kWp system/).first()).toBeVisible();

  // 3. They prepare a request from the saved estimate and choose exactly one company.
  await page.goto("/my/requests/new");
  await page.getByRole("radio", { name: /kWp system/ }).first().check();
  const details = `E2E acceptance ${randomUUID()}`;
  await page.getByLabel("What do you need quoted?").fill(details);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("checkbox", { name: `Choose ${SUNBIRD}` }).check();
  await page.getByRole("button", { name: "Send request to 1 company" }).click();
  await expect(page.getByText("Your request was sent")).toBeVisible();
  const requests = (await api("estimateCustomer", "GET", "/users/me/requests?limit=5")).body as { items: { id: string; deliveries: { id: string; company_id: string }[] }[] };
  const request = requests.items[0];
  expect(request?.deliveries.map((d) => d.company_id)).toEqual([sunbird]);
  const delivery = request?.deliveries[0]?.id ?? "";

  // 4. The company answers (prepared through its API: the browser side of this is 17.02).
  const base = `/companies/${sunbird}/request-deliveries/${delivery}`;
  const created = await api("sunbirdAdmin", "POST", `${base}/quotations`);
  const quotation = (created.body as { id: string }).id;
  expect((await api("sunbirdAdmin", "PUT", `${base}/quotations/${quotation}/draft`, { lines: [{ kind: "charge", description: "Installation and commissioning", quantity: "1", unit_price: "250000" }], discount_kind: "none", discount_value: "0.00", tax_rate_percent: "0", capacity_kwp: "3.000", warranty_terms: "Fictional 10 year warranty", exclusions: "Roof repairs", validity_days: 30 })).status).toBe(200);
  const sent = await api("sunbirdAdmin", "POST", `${base}/quotations/${quotation}/send`);
  expect(sent.status).toBe(200);
  const revision = (sent.body as { revision_id: string }).revision_id;

  // 5. The customer finds the offer and accepts exactly that revision.
  await page.goto(`/my/requests/${request?.id}`);
  await expect(page.getByText(`Offer from ${SUNBIRD}`)).toBeVisible();
  await page.goto(`/my/requests/${request?.id}/offers/${quotation}`);
  await page.getByRole("button", { name: "Accept this offer" }).click();
  await expect(page.getByText(/Accept revision 1 from/)).toBeVisible();
  await page.getByRole("button", { name: "Yes, accept this offer" }).click();

  // 6. Success opens tracking, and the accepted revision is the one that created the installation.
  await page.waitForURL(/\/my\/installations\/[0-9a-f-]+\?accepted=1/);
  await expect(page.getByText("Your offer is accepted and your installation has started.")).toBeVisible();
  await expect(page.getByText("0 of 8 steps complete")).toBeVisible();
  await expect(page.getByText("Now: Site survey")).toBeVisible();
  await expect(page.locator("[data-steps] tbody tr")).toHaveCount(8);
  const installationId = /\/my\/installations\/([0-9a-f-]+)/.exec(page.url())?.[1] ?? "";

  const mine = (await api("estimateCustomer", "GET", "/users/me/installations")).body as { items: Installation[] };
  const installation = mine.items.find((item) => item.id === installationId);
  expect(installation?.accepted_revision_id).toBe(revision);
  expect(installation?.total_milestones).toBe(8);
  const offers = (await api("estimateCustomer", "GET", `/users/me/requests/${request?.id}/quotations`)).body as Offer[];
  expect(offers.find((offer) => offer.quotation_id === quotation)?.status).toBe("accepted");

  // 7. The company can work on it, and nobody else can see it.
  expect((await api("sunbirdAdmin", "GET", `/companies/${sunbird}/installations/${installationId}`)).status).toBe(200);
  expect((await api("otherCustomer", "GET", `/users/me/installations/${installationId}`)).status).toBe(404);
  expect((await api("rivalAdmin", "GET", `/companies/${sunbird}/installations/${installationId}`)).status).toBe(403);

  // 8. Accepting again is safe: the same installation, nothing new.
  const again = await api("estimateCustomer", "POST", `/users/me/requests/${request?.id}/quotations/${quotation}/revisions/${revision}/accept`);
  expect(again.status).toBe(200);
  expect((again.body as { installation_id: string }).installation_id).toBe(installationId);
  const after = (await api("estimateCustomer", "GET", "/users/me/installations")).body as { items: Installation[] };
  expect(after.items.filter((item) => item.accepted_revision_id === revision)).toHaveLength(1);
});

test("only one offer can win a request with competing offers", async ({ page, api, signInAs }) => {
  const company = async (who: "sunbirdAdmin" | "rivalAdmin") => ((await api(who, "GET", "/users/me")).body as { memberships: { company_id: string }[] }).memberships[0]?.company_id ?? "";
  const [sunbird, rival] = [await company("sunbirdAdmin"), await company("rivalAdmin")];
  const sent = await api("estimateCustomer", "POST", "/users/me/requests", { district: "Colombo", details: `E2E competing ${randomUUID()}`, company_ids: [sunbird, rival] }, { "Idempotency-Key": randomUUID() });
  const request = sent.body as { id: string; deliveries: { id: string; company_id: string }[] };
  const offer = async (who: "sunbirdAdmin" | "rivalAdmin", companyId: string) => {
    const base = `/companies/${companyId}/request-deliveries/${request.deliveries.find((d) => d.company_id === companyId)?.id}`;
    const q = (await api(who, "POST", `${base}/quotations`)).body as { id: string };
    await api(who, "PUT", `${base}/quotations/${q.id}/draft`, { lines: [{ kind: "charge", description: "Installation", quantity: "1", unit_price: "100000" }], discount_kind: "none", discount_value: "0.00", tax_rate_percent: "0", capacity_kwp: "3.000", warranty_terms: "Fictional warranty", exclusions: "None", validity_days: 30 });
    const s = (await api(who, "POST", `${base}/quotations/${q.id}/send`)).body as { revision_id: string };
    return { quotation: q.id, revision: s.revision_id };
  };
  const a = await offer("sunbirdAdmin", sunbird);
  const b = await offer("rivalAdmin", rival);

  // The customer opens the second offer, but accepts the first elsewhere before deciding.
  signInAs("estimateCustomer");
  await page.goto(`/my/requests/${request.id}/offers/${b.quotation}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(RIVAL);
  expect((await api("estimateCustomer", "POST", `/users/me/requests/${request.id}/quotations/${a.quotation}/revisions/${a.revision}/accept`)).status).toBe(201);
  await page.getByRole("button", { name: "Accept this offer" }).click();
  await page.getByRole("button", { name: "Yes, accept this offer" }).click();
  await expect(page.getByText(/already accepted another offer/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept this offer" })).toHaveCount(0);
  const mine = (await api("estimateCustomer", "GET", "/users/me/installations")).body as { items: { accepted_revision_id: string }[] };
  expect(mine.items.filter((i) => i.accepted_revision_id === b.revision)).toHaveLength(0);
  expect(mine.items.filter((i) => i.accepted_revision_id === a.revision)).toHaveLength(1);
});
