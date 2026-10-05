import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures.ts";
import type { IdentityName } from "../identities.ts";
import { TMP_DIR } from "../support/paths.ts";
import { acceptedInstallation } from "../support/scenario.ts";

const LABEL = process.env.SCREENS_LABEL ?? "current";
const WIDTHS = (process.env.SCREENS_WIDTHS ?? "390,768,1280").split(",").map(Number);
const THEMES = (process.env.SCREENS_THEMES ?? "light,dark").split(",");
const OUT = join(TMP_DIR, "screens", LABEL);

const heightFor = (width: number) => (width <= 500 ? 844 : width <= 800 ? 1024 : 800);
const slugOf = (path: string) => (path === "/" ? "home" : path.replace(/^\/|\/$/g, "").replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, "id").replace(/[^a-z0-9]+/gi, "-"));

/** Hide the framework's development badge so it never appears in a review image. */
async function visit(page: Page, path: string) {
  await page.goto(path);
  await page.locator("main").first().waitFor();
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

async function setTheme(page: Page, theme: string) {
  await page.emulateMedia({ colorScheme: theme === "dark" ? "dark" : "light" });
  await page.evaluate((name) => {
    const root = document.documentElement;
    root.classList.toggle("dark", name === "dark");
    root.dataset.theme = name;
  }, theme);
}

/** One page in every theme and width, saved as <group>/<page>__<theme>-<width>.png. */
async function shoot(page: Page, group: string, path: string) {
  mkdirSync(join(OUT, group), { recursive: true });
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: heightFor(width) });
      await setTheme(page, theme);
      await page.waitForTimeout(200);
      await page.screenshot({ path: join(OUT, group, `${slugOf(path)}__${theme}-${width}.png`), fullPage: true, animations: "disabled" });
    }
  }
}

async function role(page: Page, signInAs: (who: IdentityName | null) => void, who: IdentityName | null, group: string, paths: string[]) {
  signInAs(who);
  for (const path of paths) {
    await visit(page, path);
    await shoot(page, group, path);
  }
}

/** A review page that lays the images out by page, so a whole set can be looked through in one browser tab. */
function writeIndex() {
  mkdirSync(OUT, { recursive: true });
  const groups = readdirSync(OUT, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const sections = groups.map((group) => {
    const files = readdirSync(join(OUT, group.name)).filter((name) => name.endsWith(".png")).sort();
    const pages = [...new Set(files.map((name) => name.split("__")[0]))];
    const rows = pages.map((pageName) => {
      const images = files.filter((name) => name.startsWith(`${pageName}__`)).map((name) => `<a href="${group.name}/${name}"><img loading="lazy" src="${group.name}/${name}" alt="${pageName} ${name.split("__")[1]}"><small>${name.split("__")[1]?.replace(".png", "")}</small></a>`);
      return `<section><h3>${pageName}</h3><div class="row">${images.join("")}</div></section>`;
    });
    return `<h2>${group.name}</h2>${rows.join("")}`;
  });
  const style = "body{font:14px system-ui;margin:24px;background:#222;color:#eee}h2{margin-top:40px;border-bottom:1px solid #555}.row{display:flex;gap:12px;align-items:flex-start;overflow-x:auto}a{color:#9cf;text-decoration:none;flex:none}img{display:block;max-height:420px;border:1px solid #555}small{display:block;text-align:center}";
  writeFileSync(join(OUT, "index.html"), `<!doctype html><meta charset="utf-8"><title>Screens: ${LABEL}</title><style>${style}</style><h1>Screens: ${LABEL}</h1>${sections.join("")}`);
}

test.afterAll(() => writeIndex());

test("public", async ({ page, signInAs }) => {
  signInAs(null);
  const paths = ["/", "/panels", "/inverters", "/estimator", "/companies", "/learn", "/learn/net-metering-and-other-schemes", "/troubleshooting", "/support", "/sign-in", "/sign-up"];
  for (const path of paths) {
    await visit(page, path);
    await shoot(page, "public", path);
  }
  for (const prefix of ["/panels", "/inverters", "/companies"]) {
    await visit(page, prefix);
    const href = await page.locator(`main a[href^="${prefix}/"]`).first().getAttribute("href");
    if (href) {
      await visit(page, href);
      await shoot(page, "public", href);
    }
  }
  // The estimate result, with its dial-to-be, in the net accounting scheme.
  await visit(page, "/estimator");
  await page.getByLabel("Monthly electricity use (kWh per month)").fill("300");
  await page.getByLabel("District").selectOption({ label: "Colombo" });
  await page.getByLabel("Usable roof area (m²)").fill("30");
  await page.getByLabel("Shading on the roof").selectOption({ label: "Partial" });
  await page.getByLabel("Share of electricity used in the daytime (%)").fill("50");
  await page.getByLabel("Connection scheme").selectOption("net_accounting");
  await page.getByRole("button", { name: "Calculate estimate" }).click();
  await expect(page.locator("[data-scheme-note]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Calculate estimate" })).not.toHaveAttribute("aria-disabled", "true");
  await shoot(page, "public", "/estimator-results");
});

test("customer", async ({ page, signInAs }) => {
  await role(page, signInAs, "customer", "customer", ["/my", "/my/requests", "/my/requests/new", "/my/estimates", "/my/installations", "/my/favourites", "/my/support", "/notifications"]);
});

test("company", async ({ page, signInAs }) => {
  await role(page, signInAs, "sunbirdAdmin", "company", ["/company", "/company/inbox", "/company/offers", "/company/installations", "/company/profile", "/company/support"]);
});

test("technician", async ({ page, signInAs }) => {
  await role(page, signInAs, "sunbirdTechnician", "technician", ["/technician", "/technician/support"]);
});

test("admin", async ({ page, signInAs }) => {
  await role(page, signInAs, "platformAdmin", "admin", ["/admin/companies", "/admin/catalogue", "/admin/estimator", "/admin/estimator/new", "/admin/troubleshooting", "/admin/education", "/admin/education/new", "/admin/users", "/admin/activity"]);
});

test("records", async ({ page, api, signInAs }) => {
  const s = await acceptedInstallation(api);
  const me = (await api("sunbirdAdmin", "GET", "/users/me")).body as { memberships: { company_id: string }[] };
  const inbox = (await api("sunbirdAdmin", "GET", `/companies/${me.memberships[0]?.company_id}/request-deliveries?limit=50`)).body as { items: { id: string; request_id: string }[] };
  const delivery = inbox.items.find((item) => item.request_id === s.requestId)?.id ?? "";
  const made = (await api("estimateCustomer", "POST", "/users/me/support-cases", { installation_id: s.installationId, symptom: "Display fault for the review screens", unsafe_now: false })).body as { id: string };

  await role(page, signInAs, "estimateCustomer", "records", [`/my/requests/${s.requestId}`, `/my/requests/${s.requestId}/compare`, `/my/requests/${s.requestId}/offers/${s.quotationId}`, `/my/installations/${s.installationId}`, `/my/support/${made.id}`]);
  await role(page, signInAs, "sunbirdAdmin", "records", [`/company/inbox/${delivery}`, `/company/inbox/${delivery}/quotation`, `/company/installations/${s.installationId}`, `/company/support/${made.id}`]);
});
