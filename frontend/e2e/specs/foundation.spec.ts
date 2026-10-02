import { IDENTITIES, type IdentityName, LOTUS, MOONLEAF, SUNBIRD } from "../identities.ts";
import { expect, test } from "../fixtures.ts";

interface Me {
  role: string;
  memberships: { company_name: string; role: string }[];
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
  test("the demo customer has the four seeded requests", async ({ page, signInAs }) => {
    signInAs("customer");
    const response = await page.request.get("/api/users/me/requests?limit=20");
    expect(response.status()).toBe(200);
    expect((await response.json()).total).toBe(4);
    await page.goto("/my/requests");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Showing 1 to 4 of 4")).toBeVisible();
  });

  test("a new customer has nothing, and the screens say so", async ({ page, signInAs }) => {
    signInAs("newCustomer");
    await page.goto("/my/requests");
    await expect(page.getByText("Showing")).toHaveCount(0);
    await expect(page.getByText("No requests yet")).toBeVisible();
  });

  test("the Sunbird administrator sees only Sunbird's two enquiries", async ({ page, signInAs }) => {
    signInAs("sunbirdAdmin");
    await page.goto("/company/inbox");
    await expect(page.getByText(SUNBIRD)).toBeVisible();
    await expect(page.getByRole("link", { name: /Enquiry|Request|Received/i })).toHaveCount(2);
  });

  test("the platform administrator sees the platform counts", async ({ page, signInAs }) => {
    signInAs("platformAdmin");
    await page.goto("/admin/activity");
    await expect(page.locator("[data-counts]")).toContainText("3");
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
