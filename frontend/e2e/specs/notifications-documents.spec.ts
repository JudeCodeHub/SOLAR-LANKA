import { readFileSync, writeFileSync } from "node:fs";

import { expect, test } from "../fixtures.ts";
import { acceptedInstallation } from "../support/scenario.ts";

interface Notification {
  id: string;
  title: string;
  read_at: string | null;
  target_id: string | null;
}
const notificationsOf = async (api: Parameters<typeof acceptedInstallation>[0], who: Parameters<typeof acceptedInstallation>[1] & string, installationId: string) =>
  ((await api(who, "GET", "/users/me/notifications?limit=50")).body as { items: Notification[] }).items.filter((item) => item.target_id === installationId);

test.describe("notifications lead to records that check access themselves", () => {
  test("the customer is told, opens the installation, and can mark it read and unread", async ({ page, api, signInAs, processOutbox }) => {
    const scenario = await acceptedInstallation(api);
    processOutbox();
    const mine = await notificationsOf(api, "estimateCustomer", scenario.installationId);
    expect(mine).toHaveLength(1);

    signInAs("estimateCustomer");
    await page.goto("/notifications");
    const card = page.locator("[data-notification]").filter({ hasText: "Quotation accepted" }).first();
    await expect(card).toHaveAttribute("data-notification", "unread");

    // Marking is one action each way, and the unread count follows.
    const before = await page.locator("[data-unread-count]").innerText();
    await card.getByRole("button", { name: "Mark as read" }).click();
    await expect(page.getByText("Marked as read.")).toBeVisible();
    expect((await notificationsOf(api, "estimateCustomer", scenario.installationId))[0]?.read_at).not.toBeNull();
    await expect(page.locator("[data-unread-count]")).not.toHaveText(before);
    await page.locator("[data-notification='read']").first().getByRole("button", { name: "Mark as unread" }).click();
    await expect(page.getByText("Marked as unread.")).toBeVisible();

    // The link opens the customer's own installation.
    await page.locator(`a[href="/my/installations/${scenario.installationId}"]`).first().click();
    await page.waitForURL(`**/my/installations/${scenario.installationId}`);
    await expect(page.getByRole("heading", { name: "Your installation", level: 1 })).toBeVisible();
    await expect(page.getByText("Now: Site survey")).toBeVisible();
  });

  test("company staff are told too and are sent to the company's page", async ({ page, api, signInAs, processOutbox }) => {
    const scenario = await acceptedInstallation(api);
    processOutbox();
    expect(await notificationsOf(api, "sunbirdAdmin", scenario.installationId)).toHaveLength(1);
    signInAs("sunbirdAdmin");
    await page.goto("/notifications");
    const link = page.locator(`a[href="/company/installations/${scenario.installationId}"]`).first();
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL(`**/company/installations/${scenario.installationId}`);
    await expect(page.getByRole("heading", { name: "Installation", level: 1 })).toBeVisible();
    await expect(page.locator("[data-step]")).toHaveCount(8);
  });

  test("a notification never grants access: the destination refuses the wrong person", async ({ page, api, signInAs, processOutbox }) => {
    const scenario = await acceptedInstallation(api);
    processOutbox();
    // The technician belongs to the company, so they are told, but a technician has no installation workspace.
    const technician = await notificationsOf(api, "sunbirdTechnician", scenario.installationId);
    expect(technician).toHaveLength(1);
    signInAs("sunbirdTechnician");
    await page.goto(`/my/installations/${scenario.installationId}`);
    await expect(page.getByText("This installation was not found, or it is not yours.").or(page.getByText(/not found/i)).first()).toBeVisible();
    expect((await api("sunbirdTechnician", "GET", `/companies/${scenario.sunbird}/installations/${scenario.installationId}`)).status).toBe(403);

    // Someone else's notification and installation are invisible and cannot be changed.
    expect(await notificationsOf(api, "otherCustomer", scenario.installationId)).toHaveLength(0);
    const id = (await notificationsOf(api, "estimateCustomer", scenario.installationId))[0]?.id ?? "";
    expect((await api("otherCustomer", "GET", `/users/me/notifications/${id}`)).status).toBe(404);
    expect((await api("otherCustomer", "PUT", `/users/me/notifications/${id}/read`)).status).toBe(404);
    expect((await api("rivalAdmin", "GET", `/companies/${scenario.sunbird}/installations/${scenario.installationId}`)).status).toBe(403);

    signInAs("otherCustomer");
    await page.goto(`/my/installations/${scenario.installationId}`);
    await expect(page.getByText(/not found/i).first()).toBeVisible();

    // Signed out, the notification list is refused.
    signInAs(null);
    expect((await page.request.get("/api/users/me/notifications")).status()).toBe(401);
  });
});

test.describe("private evidence stays with the company", () => {
  test("staff upload, complete and download; the customer is told but never gets the file", async ({ page, api, signInAs, processOutbox }, testInfo) => {
    const scenario = await acceptedInstallation(api);
    processOutbox();
    const photo = testInfo.outputPath("survey.png");
    writeFileSync(photo, Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(2048, 7)]));

    signInAs("sunbirdAdmin");
    await page.goto(`/company/installations/${scenario.installationId}`);
    const step = page.locator("[data-step='in_progress']").first();
    await step.locator("input[type=file]").setInputFiles(photo);
    await expect(step.getByText("Uploaded: survey.png")).toBeVisible();
    await step.getByLabel("Note for the customer").fill("Survey finished");
    await step.getByRole("button", { name: "Mark as completed" }).click();
    await expect(page.getByText(/is now Completed/)).toBeVisible();

    // The authorised member downloads exactly what was uploaded, through the access-checked route.
    const completed = page.locator("[data-step='completed']").first();
    const [download] = await Promise.all([page.waitForEvent("download"), completed.getByRole("button", { name: /Download/ }).click()]);
    const saved = await download.path();
    expect(saved).not.toBeNull();

    const progress = (await api("sunbirdAdmin", "GET", `/companies/${scenario.sunbird}/installations/${scenario.installationId}`)).body as { milestones: { evidence: { asset_id: string }[] }[] };
    const asset = progress.milestones[0]?.evidence[0]?.asset_id ?? "";
    const url = `/companies/${scenario.sunbird}/installations/${scenario.installationId}/evidence/${asset}`;
    const fetched = await api("sunbirdAdmin", "GET", url);
    expect(fetched.status).toBe(200);
    expect(fetched.bytes?.equals(readFileSync(photo))).toBe(true);
    expect(readFileSync(saved ?? "").equals(readFileSync(photo))).toBe(true);

    // Everyone else is refused the file.
    for (const who of ["estimateCustomer", "otherCustomer", "rivalAdmin", "sunbirdTechnician"] as const) {
      expect([403, 404], who).toContain((await api(who, "GET", url)).status);
    }
    signInAs(null);
    expect((await page.request.get(`/api/${url.slice(1)}`)).status()).toBe(401);
    expect((await api("sunbirdAdmin", "GET", url.replace(asset, "00000000-0000-4000-8000-000000000000"))).status).toBe(404);

    // The step moving on tells the customer, who sees that evidence exists but gets no file.
    processOutbox();
    expect((await notificationsOf(api, "estimateCustomer", scenario.installationId)).length).toBeGreaterThanOrEqual(2);
    signInAs("estimateCustomer");
    await page.goto(`/my/installations/${scenario.installationId}`);
    await expect(page.getByText("1 of 8 steps complete")).toBeVisible();
    await expect(page.getByText("1 evidence file attached")).toBeVisible();
    await expect(page.getByRole("button", { name: /Download/ })).toHaveCount(0);
    await expect(page.getByText("Survey finished")).toBeVisible();
  });
});
