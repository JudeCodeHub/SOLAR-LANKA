import { expect, test } from "../fixtures.ts";
import { acceptedInstallation } from "../support/scenario.ts";

test.describe("troubleshooting is exact, sourced and safe", () => {
  test("an exact model gets its own references, hazards first, with sources", async ({ page, signInAs }) => {
    signInAs(null);
    await page.goto("/troubleshooting");
    await page.getByLabel("Your model").fill("GW3000-DNS-30");
    await page.getByRole("button", { name: "Look up" }).click();
    const result = page.locator("[data-result='exact']");
    await expect(result).toBeVisible();
    await expect(result.locator("[data-reference]").first()).toHaveAttribute("data-reference", "hazard");
    await expect(result.locator("[data-hazard]")).toContainText("Do not touch it");
    await expect(result.locator("[data-hazard]")).toContainText("call a qualified technician");
    // The hazard shows no routine steps; the safe reference shows observations only.
    const safe = result.locator("[data-reference='safe_observation']");
    await expect(safe.getByText("Do not open the inverter or touch its cables.")).toBeVisible();
    await expect(safe.getByText("Safe things to check")).toBeVisible();
    await expect(result.locator("[data-source]")).toHaveCount(2);
    await expect(result.getByText("Sample content, written for this demonstration.").first()).toBeVisible();
    await expect(result.getByRole("link", { name: "Open the source" }).first()).toHaveAttribute("href", /example\.org/);
    await expect(result.getByRole("link", { name: "Report this problem to your installer" })).toBeVisible();
  });

  test("a code narrows the answer, and a missing code is said, not filled in", async ({ page, signInAs }) => {
    signInAs(null);
    await page.goto("/troubleshooting");
    await page.getByLabel("Your model").fill("GW3000-DNS-30");
    await page.getByLabel("Code shown (optional)").fill("e01");
    await page.getByRole("button", { name: "Look up" }).click();
    await expect(page.locator("[data-reference]")).toHaveCount(1);
    await expect(page.locator("[data-reference]")).toHaveAttribute("data-reference", "safe_observation");
    await page.getByLabel("Code shown (optional)").fill("E99");
    await page.getByRole("button", { name: "Look up" }).click();
    await expect(page.locator("[data-no-references]")).toContainText("no published reference");
    await expect(page.locator("[data-reference]")).toHaveCount(0);
  });

  test("a similar model gets no instructions, only names to pick from", async ({ page, signInAs }) => {
    signInAs(null);
    await page.goto("/troubleshooting");
    await page.getByLabel("Your model").fill("GW3000-DNS");
    await page.getByRole("button", { name: "Look up" }).click();
    const result = page.locator("[data-result='none']");
    await expect(result).toBeVisible();
    await expect(page.locator("[data-reference]")).toHaveCount(0);
    await expect(result.getByText("different model may not apply")).toBeVisible();
    await expect(result.locator("[data-suggestions] li").first()).toBeVisible();
    // The sibling model exists but has no guidance of its own, and never borrows its neighbour's.
    await page.getByLabel("Your model").fill("GW3600-DNS-30");
    await page.getByRole("button", { name: "Look up" }).click();
    await expect(page.locator("[data-result='exact']")).toBeVisible();
    await expect(page.locator("[data-reference]")).toHaveCount(0);
    await expect(page.getByText("Display shows a grid fault code")).toHaveCount(0);
    await page.getByLabel("Your model").fill("  ");
    await page.getByRole("button", { name: "Look up" }).click();
    await expect(page.locator("[data-error='model']")).toBeVisible();
  });
});

test.describe("support requests", () => {
  test("a reported danger is answered with safety first, worked by the assigned technician only, and shown to the customer selectively", async ({ page, api, signInAs, processOutbox }) => {
    const s = await acceptedInstallation(api);

    // The customer reports a problem that may be dangerous: warned before and after sending.
    signInAs("estimateCustomer");
    await page.goto("/my/support");
    await expect(page.locator("[data-safety]")).toContainText("do not touch the equipment");
    await page.getByRole("button", { name: "Send to the company" }).click();
    await expect(page.locator("[data-error='symptom']")).toBeVisible();
    const choice = page.locator("#installation");
    if (await choice.count()) await choice.selectOption({ index: 1 });
    await page.getByLabel("What is happening?").fill(`Inverter smells of burning ${s.requestId.slice(0, 8)}`);
    await page.getByLabel("Code shown on the equipment (optional)").fill("E09");
    await page.getByLabel("This may be dangerous right now").check();
    await expect(page.locator("[data-unsafe-warning]")).toBeVisible();
    await page.getByRole("button", { name: "Send to the company" }).click();
    await expect(page.locator("[data-sent]")).toContainText("do not touch");
    const mine = (await api("estimateCustomer", "GET", "/users/me/support-cases")).body as { id: string; symptom: string; installation_id: string }[];
    const created = mine.find((c) => c.symptom.includes(s.requestId.slice(0, 8)));
    expect(created).toBeTruthy();
    const caseId = created?.id ?? "";
    const staffPath = `/companies/${s.sunbird}/support-cases/${caseId}`;

    // Before assignment the technician sees nothing; other people are refused.
    const before = (await api("sunbirdTechnician", "GET", "/technician/support-cases")).body as { id: string }[];
    expect(before.map((c) => c.id)).not.toContain(caseId);
    expect((await api("sunbirdTechnician", "GET", `/technician/support-cases/${caseId}`)).status).toBe(404);
    expect((await api("otherCustomer", "GET", `/users/me/support-cases/${caseId}`)).status).toBe(404);
    expect((await api("rivalAdmin", "GET", staffPath)).status).toBe(403);
    expect((await api("sunbirdTechnician", "GET", staffPath)).status).toBe(403);

    // The company sees the danger first and assigns the technician.
    signInAs("sunbirdAdmin");
    await page.goto("/company/support");
    await expect(page.locator("[data-case]").first()).toHaveAttribute("data-unsafe", "true");
    await page.locator(`a[href^="/company/support/${caseId}"]`).click();
    await expect(page.locator("[role='alert'][data-unsafe]")).toBeVisible();
    const technician = (await page.locator("#technician option").nth(1).getAttribute("value")) ?? "";
    await page.locator("[data-action='assign']").click();
    await expect(page.locator("[data-error='problem']")).toBeVisible(); // choose one first
    await page.locator("#technician").selectOption(technician);
    await page.locator("[data-action='assign']").click();
    await expect(page.locator("[data-assigned] li")).toHaveCount(1);
    await page.getByRole("button", { name: "Start looking at it" }).click();
    await page.getByRole("button", { name: "Start looking at it" }).last().click();
    await expect(page.locator("p[data-status]").first()).toContainText("Being looked at");

    // The assigned technician sees the problem, never the customer, and writes one internal and one shared update.
    signInAs("sunbirdTechnician");
    await page.goto("/technician/support");
    await page.locator(`a[href="/technician/support/${caseId}"]`).click();
    await expect(page.locator("[role='alert'][data-unsafe]")).toBeVisible();
    await expect(page.locator("main")).not.toContainText(s.requestId);
    await page.getByLabel("Add an update").fill("Isolated the string, internal only");
    await page.getByRole("button", { name: "Add update" }).click();
    await expect(page.locator("[data-update][data-shared='false']").filter({ hasText: "Isolated the string" })).toHaveCount(1);
    await page.getByLabel("Add an update").fill("I will visit tomorrow morning");
    await page.getByLabel("Show this to the customer").check();
    await page.getByRole("button", { name: "Add update" }).click();
    await expect(page.locator("[data-update][data-shared='true']").last()).toContainText("I will visit tomorrow");

    // The customer reads only what was shared, with no names, and is notified.
    processOutbox();
    signInAs("estimateCustomer");
    await page.goto(`/my/support/${caseId}`);
    await expect(page.locator("[data-safety-notice]")).toBeVisible();
    await expect(page.locator("[data-updates]")).toContainText("I will visit tomorrow morning");
    await expect(page.locator("main")).not.toContainText("Isolated the string");
    await expect(page.locator("[data-updates]")).not.toContainText("Technician,");
    await page.goto("/notifications");
    await expect(page.locator(`a[href="/my/support/${caseId}"]`).first()).toBeVisible();

    // The company resolves it (closing early needs a reason); the customer says it is not fixed.
    signInAs("sunbirdAdmin");
    await page.goto(`/company/support/${caseId}`);
    await page.getByRole("button", { name: "Mark as resolved" }).click();
    await page.getByRole("button", { name: "Mark as resolved" }).last().click();
    await expect(page.locator("p[data-status]").first()).toContainText("Resolved");
    signInAs("estimateCustomer");
    await page.goto(`/my/support/${caseId}`);
    await page.getByRole("button", { name: "Not fixed: reopen it" }).click();
    await page.getByRole("button", { name: "Not fixed: reopen it" }).last().click();
    await expect(page.locator("p[data-status]").first()).toContainText("Open");
    expect((await api("estimateCustomer", "GET", `/users/me/support-cases/${caseId}`)).status).toBe(200);

    // Removing the technician ends their access at once.
    await api("sunbirdAdmin", "DELETE", `${staffPath}/assignments/${technician}`);
    expect((await api("sunbirdTechnician", "GET", `/technician/support-cases/${caseId}`)).status).toBe(404);
    signInAs("sunbirdTechnician");
    await page.goto(`/technician/support/${caseId}`);
    await expect(page.getByText(/not found|could not be found/i).first()).toBeVisible();
  });
});
