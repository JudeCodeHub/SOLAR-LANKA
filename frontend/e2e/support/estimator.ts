import type { Page } from "@playwright/test";

/** Choose a connection scheme card: the radios are visually hidden, so click through the card they sit in. */
export async function chooseScheme(page: Page, value: "net_metering" | "net_accounting" | "net_plus" | "net_plus_plus") {
  await page.locator(`input[name="connection_scheme"][value="${value}"]`).check({ force: true });
}
