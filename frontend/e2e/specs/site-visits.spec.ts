import { readFileSync, writeFileSync } from "node:fs";

import { expect, test } from "../fixtures.ts";
import { acceptedInstallation } from "../support/scenario.ts";

const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
// The shared technician is booked by every run, so each run picks its own day within the 90 day horizon.
const DAY = 14 + Math.floor(Math.random() * 70);

interface Visit {
  id: string;
  status: string;
  slots: { id: string }[];
}

test("a visit goes from request to completion, and the right people see the right things", async ({ page, api, signInAs, startVisit }, testInfo) => {
  const s = await acceptedInstallation(api);
  const visits = async (who: "estimateCustomer" | "sunbirdAdmin") =>
    (await api(who, "GET", who === "estimateCustomer" ? `/users/me/installations/${s.installationId}/site-visits` : `/companies/${s.sunbird}/installations/${s.installationId}/site-visits`)).body as Visit[];

  // 1. The customer asks for a visit with an explicit time, and bad inputs are explained before anything is sent.
  signInAs("estimateCustomer");
  await page.goto(`/my/installations/${s.installationId}`);
  await page.getByRole("button", { name: "Request a visit" }).click();
  await expect(page.locator("[data-error='0.date']")).toBeVisible();
  expect(await visits("estimateCustomer")).toHaveLength(0);
  await page.getByLabel("Date", { exact: true }).fill(daysAhead(DAY));
  await page.getByLabel("From", { exact: true }).fill("22:00");
  await page.getByLabel("To", { exact: true }).fill("23:00");
  await page.getByLabel("Note for the company (optional)").fill("Gate code 1234");
  await page.getByRole("button", { name: "Request a visit" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "07:00 and 19:00" })).toBeVisible(); // the server's rule, in words
  await page.getByLabel("From", { exact: true }).fill("09:00");
  await page.getByLabel("To", { exact: true }).fill("11:00");
  await page.getByRole("button", { name: "Request a visit" }).click();
  await expect(page.getByText("Visit requested.")).toBeVisible();
  await expect(page.locator("[data-visit='requested']")).toBeVisible();
  await expect(page.locator("[data-request-form]")).toHaveCount(0); // one waiting visit at a time
  const visit = (await visits("estimateCustomer"))[0] as Visit;

  // 2. The company confirms it with an eligible technician; it must pick one first.
  signInAs("sunbirdAdmin");
  await page.goto(`/company/installations/${s.installationId}`);
  const staff = page.locator("[data-staff-visits]");
  await expect(staff.getByText("Customer's note: Gate code 1234")).toBeVisible();
  await staff.getByRole("button", { name: "Confirm this time" }).click();
  await expect(staff.locator("[data-error='technician']")).toBeVisible();
  const technician = (await staff.locator("select option").nth(1).getAttribute("value")) ?? "";
  expect(technician).not.toBe("");
  await staff.getByLabel("Technician").selectOption(technician);
  await staff.getByRole("button", { name: "Confirm this time" }).click();
  await expect(staff.locator("[data-visit='confirmed']")).toBeVisible();
  expect((await visits("sunbirdAdmin"))[0]?.status).toBe("confirmed");

  // 3. A second visit at an overlapping time cannot book the same technician.
  const clash = (await api("estimateCustomer", "POST", `/users/me/installations/${s.installationId}/site-visits`, { timezone: "Asia/Colombo", slots: [{ starts_at: `${daysAhead(DAY)}T10:00:00+05:30`, ends_at: `${daysAhead(DAY)}T12:00:00+05:30` }] })).body as Visit;
  await page.reload();
  const second = staff.locator(`[data-visit='requested']`);
  await second.getByLabel("Technician").selectOption(technician);
  await second.getByRole("button", { name: "Confirm this time" }).click();
  await expect(staff.locator("[data-clash]")).toContainText("already has a confirmed visit");
  expect((await visits("sunbirdAdmin")).find((v) => v.id === clash.id)?.status).toBe("requested");
  await staff.locator("[data-visit='requested'] >> text=Cancel this visit").click();
  await staff.getByRole("button", { name: "Yes, cancel it" }).click();
  await expect(staff.locator("[data-visit='cancelled']")).toBeVisible();

  // 4. The customer sees the confirmed time, never the technician.
  signInAs("estimateCustomer");
  await page.goto(`/my/installations/${s.installationId}`);
  await expect(page.locator("[data-visits] [data-confirmed]")).toContainText("09:00 to 11:00");
  await expect(page.locator("[data-visits]")).not.toContainText(technician.slice(0, 8));

  // 5. The technician sees only the minimum, and cannot finish a visit that has not started.
  signInAs("sunbirdTechnician");
  await page.goto("/technician");
  await page.locator(`a[href="/technician/visits/${visit.id}"]`).click();
  await page.waitForURL(/\/technician\/visits\//);
  await expect(page.locator("[data-customer-note]")).toContainText("Gate code 1234");
  await expect(page.locator("[data-not-started]")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(s.requestId);

  // 6. Once it has started: a note, a photo, then completion with a summary.
  startVisit(visit.id);
  await page.reload();
  await page.getByLabel("Add a note").fill("Roof is steep");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.locator("[data-notes]")).toContainText("Roof is steep");
  const photo = testInfo.outputPath("roof.png");
  writeFileSync(photo, Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(1024, 3)]));
  await page.locator("#photo").setInputFiles(photo);
  await expect(page.locator("[data-photos] li")).toHaveCount(1);
  await page.getByRole("button", { name: "Complete the visit" }).click();
  await expect(page.locator("[data-error='summary']")).toBeVisible(); // a summary is required
  await page.getByLabel("Summary for the customer").fill("Roof surveyed, ready for design");
  await page.getByRole("button", { name: "Complete the visit" }).click();
  await page.getByRole("button", { name: "Yes, complete it" }).click();
  await expect(page.locator("[data-completed]")).toContainText("Roof surveyed, ready for design");
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-photos] [data-download]").first().click()]);
  expect(readFileSync((await download.path()) ?? "").equals(readFileSync(photo))).toBe(true);

  // 7. The company sees the work and the photo; the customer sees only the outcome.
  signInAs("sunbirdAdmin");
  await page.goto(`/company/installations/${s.installationId}`);
  await expect(page.locator("[data-staff-visits] [data-summary]")).toContainText("Roof surveyed");
  await expect(page.locator("[data-staff-visits] [data-work]")).toContainText("Roof is steep");
  await expect(page.locator("[data-staff-visits] [data-work] [data-download]")).toHaveCount(1);
  signInAs("estimateCustomer");
  await page.goto(`/my/installations/${s.installationId}`);
  await expect(page.locator("[data-visits] [data-summary]")).toContainText("Roof surveyed, ready for design");
  await expect(page.locator("[data-visits]")).not.toContainText("Roof is steep");
  await expect(page.locator("[data-visits] [data-download]")).toHaveCount(0);

  // 8. Everyone else is refused: another customer, sales staff who are not on the job's company, and the customer on the technician page.
  signInAs("estimateCustomer");
  await page.goto(`/technician/visits/${visit.id}`);
  await expect(page.getByText("This visit was not found, or it is not assigned to you.").or(page.getByText(/not found/i)).first()).toBeVisible();
  expect((await api("otherCustomer", "GET", `/users/me/installations/${s.installationId}/site-visits`)).status).toBe(404);
  expect((await api("rivalAdmin", "GET", `/companies/${s.sunbird}/installations/${s.installationId}/site-visits`)).status).toBe(403);
  expect((await api("estimateCustomer", "GET", `/technician/site-visits/${visit.id}`)).status).toBe(404);
});
