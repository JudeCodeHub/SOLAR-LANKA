import { randomUUID } from "node:crypto";

import { expect, test } from "../fixtures.ts";

// Pages are compiled by the development server the first time they are asked for.
test.describe.configure({ timeout: 120_000 });

const SOURCE = { title: "Fictional guide", publisher: "Demo Publisher", url: "https://example.org/guide", accessed_on: "2026-09-28" };

test.describe("the learning centre", () => {
  test("lists, filters and searches published articles, and marks the time-sensitive ones", async ({ page, signInAs }) => {
    signInAs(null);
    await page.goto("/learn");
    await expect(page.locator("[data-article='how-rooftop-solar-works']")).toBeVisible();
    // Topic filter: costs and tariffs holds the two time-sensitive explanations.
    await page.getByRole("navigation", { name: "Topics" }).getByRole("link", { name: /Costs and tariffs/ }).click();
    await expect(page.locator("[data-article='net-metering-and-other-schemes'] [data-badge='time-sensitive']")).toBeVisible();
    await expect(page.locator("[data-article='understanding-your-electricity-bill'] [data-badge='time-sensitive']")).toBeVisible();
    await expect(page.locator("[data-article='how-rooftop-solar-works']")).toHaveCount(0);
    // Search ranks and filters; nothing matching says so.
    await page.goto("/learn");
    await page.getByLabel("Search the guides").fill("inverter");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.locator("[data-article='panels-and-inverters-explained']")).toBeVisible();
    await expect(page.locator("[data-article='understanding-your-electricity-bill']")).toHaveCount(0);
    await page.getByLabel("Search the guides").fill("zebra giraffe");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("No articles match.")).toBeVisible();
    // An article the plain sample label applies to is labelled as such.
    await page.goto("/learn");
    await expect(page.locator("[data-badge='sample']").first()).toBeVisible();
  });

  test("an article shows its text, its review, its sources, its date warning and related articles", async ({ page, signInAs }) => {
    signInAs(null);
    await page.goto("/learn/net-metering-and-other-schemes");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Net metering and other connection schemes");
    const note = page.locator("[data-currency]");
    await expect(note).toContainText("can change");
    await expect(note).toContainText("28 September 2026");
    await expect(page.locator("main")).toContainText("Reviewed on 28 September 2026");
    await expect(page.locator("[data-sources] a").first()).toHaveAttribute("href", /pucsl\.gov\.lk/);
    await expect(page.locator("[data-related] a")).toContainText("Understanding your electricity bill");
    await expect(page.locator("main")).toContainText("This is sample content");
    // A malformed or unpublished address is not found.
    await page.goto("/learn/does-not-exist");
    await expect(page.getByText(/not found/i).first()).toBeVisible();
  });

  test("drafts stay private and article text is never run as markup", async ({ page, api, signInAs }) => {
    const category = (await api("platformAdmin", "GET", "/education/categories")).body as { id: string; slug: string }[];
    const solar = category.find((c) => c.slug === "solar-basics")?.id ?? "";
    const slug = `private-${randomUUID().slice(0, 8)}`;
    const made = (await api("platformAdmin", "POST", "/admin/education/articles", { category_id: solar, slug, title: "Private draft", summary: "Only for us.", body: "Hidden.", sources: [SOURCE] })).body as { id: string };
    signInAs(null);
    await page.goto(`/learn/${slug}`);
    await expect(page.getByText(/not found/i).first()).toBeVisible();
    await page.goto("/learn?search=private");
    await expect(page.locator(`[data-article='${slug}']`)).toHaveCount(0);

    // Reviewed by a second administrator and published, hostile text shows as text.
    const hostile = `hostile-${randomUUID().slice(0, 8)}`;
    const text = "Plain words. <script>window.__ran = true</script><b>bold</b><img src=x onerror=\"window.__ran = true\">";
    const other = (await api("platformAdmin", "POST", "/admin/education/articles", { category_id: solar, slug: hostile, title: "Hostile text", summary: "Markup test.", body: text, sources: [SOURCE] })).body as { id: string };
    await api("contentReviewer", "POST", `/admin/education/articles/${other.id}/review`);
    await api("platformAdmin", "POST", `/admin/education/articles/${other.id}/publish`);
    await page.goto(`/learn/${hostile}`);
    await expect(page.locator("[data-body]")).toContainText("<script>window.__ran = true</script>");
    await expect(page.locator("[data-body] b, [data-body] script, [data-body] img")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __ran?: boolean }).__ran)).toBeUndefined();
    expect(made.id).toBeTruthy();
  });
});

test.describe("managing learning content", () => {
  test("a draft needs another administrator's review before it is published, and publishing makes it searchable", async ({ page, signInAs }) => {
    const slug = `guide-${randomUUID().slice(0, 8)}`;
    signInAs("platformAdmin");
    await page.goto("/admin/education/new");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.locator("[data-error-summary]")).toBeFocused();
    await expect(page.locator("[data-error='category_id']")).toBeVisible();
    await page.getByLabel("Topic").selectOption({ label: "Solar basics" });
    await page.locator("#a-title").fill(`Guide ${slug}`);
    await page.locator("#a-slug").fill(slug);
    await page.locator("#a-summary").fill("A short test guide about quartzite roofs.");
    await page.locator("#a-body").fill("Quartzite roofing is mentioned only in this guide.\n\nSecond paragraph.");
    await page.locator("#s-0-title").fill("Fictional source");
    await page.locator("#s-0-publisher").fill("Demo Publisher");
    await page.locator("#s-0-url").fill("not a web address");
    await page.locator("#s-0-accessed_on").fill("2026-09-28");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.locator("[data-error='sources.0.url']")).toBeVisible();
    await page.locator("#s-0-url").fill("https://example.org/roofs");
    await page.getByRole("button", { name: "Create draft" }).click();
    await page.waitForURL(/\/admin\/education\/[0-9a-f-]{36}$/);
    await expect(page.locator("p[data-status]").first()).toContainText("Draft");

    // The author cannot review their own work.
    await expect(page.locator("[data-own-work]")).toBeVisible();
    await expect(page.locator("[data-action='review']")).toHaveAttribute("aria-disabled", "true");
    const url = page.url();

    // Private until published: the public search finds nothing.
    signInAs(null);
    await page.goto("/learn?search=quartzite");
    await expect(page.getByText("No articles match.")).toBeVisible();

    // Another administrator reviews it.
    signInAs("contentReviewer");
    await page.goto(url);
    await page.locator("[data-action='review']").click();
    await page.getByRole("button", { name: "Yes, I have reviewed it" }).click();
    await expect(page.getByText(/Reviewed on \d{4}/)).toBeVisible();

    // The author publishes it; now it is searchable and readable.
    signInAs("platformAdmin");
    await page.goto(url);
    await page.locator("[data-action='publish']").click();
    await page.getByRole("button", { name: "Yes, publish" }).click();
    await expect(page.locator("p[data-status]").first()).toContainText("Published");
    await expect(page.locator("[data-read-only]")).toBeVisible();
    signInAs(null);
    await page.goto("/learn?search=quartzite");
    await expect(page.locator(`[data-article='${slug}']`)).toBeVisible();
    await page.goto(`/learn/${slug}`);
    await expect(page.locator("[data-body] p")).toHaveCount(2);

    // Returning it to a draft takes it offline at once.
    signInAs("platformAdmin");
    await page.goto(url);
    await page.locator("[data-action='unpublish']").click();
    await page.getByRole("button", { name: "Yes, return to draft" }).click();
    await expect(page.locator("p[data-status]").first()).toContainText("Draft");
    signInAs(null);
    await page.goto(`/learn/${slug}`);
    await expect(page.getByText(/not found/i).first()).toBeVisible();
  });

  test("only platform administrators can reach the management screens", async ({ page, api, signInAs }) => {
    expect((await api("customer", "GET", "/admin/education/articles")).status).toBe(403);
    expect((await api("sunbirdAdmin", "POST", "/admin/education/categories", { slug: "x", name: "X" })).status).toBe(403);
    signInAs("customer");
    await page.goto("/admin/education");
    await expect(page.getByText("Platform administrators only")).toBeVisible();
  });
});
