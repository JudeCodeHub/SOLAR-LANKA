import { expect, test } from "@playwright/test";

/** A development server is slower than a built site, so these are limits on shape (what loads first, what moves), not on speed. */
for (const width of [390, 1280]) {
  test(`the landing hero loads first, the layout holds still and the motion stays within budget at ${width} px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width, height: width < 800 ? 844 : 800 });
    const responses: { url: string; bytes: number; type: string }[] = [];
    page.on("response", async (response) => {
      const type = response.headers()["content-type"] ?? "";
      if (/image|font/.test(type)) responses.push({ url: response.url(), bytes: Number(response.headers()["content-length"] ?? 0), type });
    });
    await page.addInitScript(() => {
      (window as unknown as { __shifts: number }).__shifts = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!entry.hadRecentInput) (window as unknown as { __shifts: number }).__shifts += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/");
    await page.locator("[data-hero]").waitFor();

    // The hero photo is requested early with high priority, and the display font is preloaded.
    const preloads = await page.evaluate(() => [...document.querySelectorAll('link[rel="preload"]')].map((link) => ({ as: link.getAttribute("as"), href: link.getAttribute("href") ?? "", imagesrcset: link.getAttribute("imagesrcset") ?? "", priority: link.getAttribute("fetchpriority") })));
    expect(preloads.some((link) => link.as === "font" && /woff2/.test(link.href)), "a font is preloaded").toBe(true);
    expect(preloads.some((link) => link.as === "image" && /hero-rooftop/.test(link.imagesrcset + link.href)), "the hero image is preloaded").toBe(true);
    const hero = page.locator("[data-hero] img").first();
    expect(await hero.getAttribute("fetchpriority")).toBe("high");
    expect(await hero.getAttribute("loading")).not.toBe("lazy");

    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // Only the right size of the hero photo came down, and it is small.
    const heroFiles = responses.filter((item) => /hero-rooftop/.test(item.url));
    expect(heroFiles.length, "one hero file").toBeGreaterThan(0);
    for (const file of heroFiles) expect(file.bytes, file.url).toBeLessThan(200_000);
    // Photos far down the page are not fetched before they are needed.
    expect(responses.some((item) => /journey-handover|share-card/.test(item.url)), "far photos wait until scrolled to").toBe(false);

    // Layout does not jump while it loads.
    const shifts = await page.evaluate(() => (window as unknown as { __shifts: number }).__shifts);
    expect(shifts, `layout shift ${shifts}`).toBeLessThan(0.05);

    // Motion budget: the entrance is finished and nothing loops.
    const running = await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === "running").length);
    expect(running, "animations still running after the entrance").toBe(0);
  });
}
