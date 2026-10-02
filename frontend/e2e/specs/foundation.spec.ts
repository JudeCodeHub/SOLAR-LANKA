import { IDENTITIES, type IdentityName, LOTUS, MOONLEAF, SUNBIRD } from "../identities.ts";
import { expect, test } from "../fixtures.ts";

const companyId = async (api: (who: "sunbirdAdmin", method: string, path: string) => Promise<{ body: unknown }>) =>
  ((await api("sunbirdAdmin", "GET", "/users/me")).body as Me).memberships[0]?.company_id ?? "";

interface Me {
  role: string;
  memberships: { company_id: string; company_name: string; role: string }[];
}

test.describe("controlled demo identities", () => {
  for (const name of Object.keys(IDENTITIES) as IdentityName[]) {
    test(`${name} is who the table says`, async ({ api, signInAs }) => {
      signInAs(name);
      const { status, body } = await api(name, "GET", "/users/me");
      const me = body as Me;
      expect(status).toBe(200);
      expect(me.role).toBe(IDENTITIES[name].role);
      const company = IDENTITIES[name].company;
      expect(me.memberships.map((m) => [m.company_name, m.role])).toEqual(company ? [[company.name, company.role]] : []);
    });
  }

  test("nobody signed in is refused by the API", async ({ page, signInAs }) => {
    signInAs(null);
    const response = await page.request.get("/api/users/me");
    expect(response.status()).toBe(401);
  });
});

test.describe("known data", () => {
  test("the demo customer has at least the four seeded requests", async ({ page, signInAs }) => {
    signInAs("customer");
    const response = await page.request.get("/api/users/me/requests?limit=20");
    expect(response.status()).toBe(200);
    // Other tests add their own requests, so the seeded four are a minimum, never an exact count.
    expect((await response.json()).total).toBeGreaterThanOrEqual(4);
    await page.goto("/my/requests");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/Showing 1 to \d+ of \d+/)).toBeVisible();
  });

  test("a new customer has nothing, and the screens say so", async ({ page, signInAs }) => {
    signInAs("newCustomer");
    await page.goto("/my/requests");
    await expect(page.getByText("Showing")).toHaveCount(0);
    await expect(page.getByText("No requests yet")).toBeVisible();
  });

  test("the Sunbird administrator sees Sunbird's enquiries and no other company's", async ({ page, api, signInAs }) => {
    signInAs("sunbirdAdmin");
    await page.goto("/company/inbox");
    await expect(page.getByText(SUNBIRD)).toBeVisible();
    const seeded = await api("sunbirdAdmin", "GET", `/companies/${(await companyId(api))}/request-deliveries?limit=50`);
    expect((seeded.body as { total: number }).total).toBeGreaterThanOrEqual(2);
    await expect(page.getByText(/Received /).first()).toBeVisible();
  });

  test("the platform administrator sees the platform counts the API reports", async ({ page, api, signInAs }) => {
    signInAs("platformAdmin");
    const counts = (await api("platformAdmin", "GET", "/admin/activity")).body as { users: number; approved_companies: number; active_products: number };
    // The three demo companies are a minimum: browser tests add their own.
    expect(counts.approved_companies).toBeGreaterThanOrEqual(3);
    await page.goto("/admin/activity");
    const shown = page.locator("[data-counts]");
    await expect(shown).toContainText(`Accounts${counts.users}`);
    await expect(shown).toContainText(`Approved companies${counts.approved_companies}`);
    await expect(shown).toContainText(`Active products${counts.active_products}`);
  });

  test("three approved companies are listed publicly", async ({ page, signInAs }) => {
    signInAs(null);
    await page.goto("/companies");
    for (const name of [SUNBIRD, MOONLEAF, LOTUS]) await expect(page.getByText(name).first()).toBeVisible();
  });
});

test.describe("access that must fail", () => {
  test("a customer cannot use platform administration or another company's inbox", async ({ api }) => {
    expect((await api("customer", "GET", "/admin/companies/pending")).status).toBe(403);
    expect((await api("customer", "GET", "/admin/activity")).status).toBe(403);
  });

  test("a technician has no company inbox, and another company's staff cannot read Sunbird's", async ({ api }) => {
    const me = (await api("sunbirdAdmin", "GET", "/users/me")).body as { memberships: { company_id: string }[] };
    const sunbird = me.memberships[0]?.company_id;
    expect((await api("sunbirdTechnician", "GET", `/companies/${sunbird}/request-deliveries`)).status).toBe(403);
    expect((await api("moonleafAdmin", "GET", `/companies/${sunbird}/request-deliveries`)).status).toBe(403);
    expect((await api("sunbirdAdmin", "GET", `/companies/${sunbird}/request-deliveries`)).status).toBe(200);
  });

  test("another customer cannot see the demo customer's requests", async ({ api }) => {
    const mine = (await api("customer", "GET", "/users/me/requests?limit=1")).body as { items: { id: string }[] };
    const id = mine.items[0]?.id;
    expect((await api("otherCustomer", "GET", `/users/me/requests/${id}`)).status).toBe(404);
  });
});
