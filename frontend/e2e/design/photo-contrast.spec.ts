import { expect, test } from "@playwright/test";

/** Text that sits over a photo or a gradient: measured on the real pixels behind each line, because the colour tokens alone cannot say. */
const AREAS = [
  { name: "hero", root: "[data-hero]", text: "h1, p" },
  { name: "hero sample card", root: "[data-hero] [data-slot='card']", text: "p, span" },
  { name: "closing band", root: "[data-closing-band]", text: "h2, p" },
];

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`text over photos keeps its contrast (${theme}, ${width} px)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(process.env.DESIGN_URL ?? "/");
      await page.waitForLoadState("networkidle");
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      const failures: string[] = [];
      let measured = 0;
      for (const area of AREAS) {
        const root = page.locator(area.root).first();
        await root.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        // Each line is read (box, size, colour), then all text is hidden so the pixels behind it can be measured.
        const count = await root.locator(area.text).count();
        for (let index = 0; index < count; index += 1) {
          const element = root.locator(area.text).nth(index);
          const hasText = await element.evaluate((node) => [...node.childNodes].some((child) => child.nodeType === 3 && (child.textContent ?? "").trim() !== ""));
          if (!hasText || !(await element.isVisible())) continue;
          await element.scrollIntoViewIfNeeded();
          const info = await element.evaluate((node) => {
            const box = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            return { label: (node.textContent ?? "").trim().slice(0, 30), x: box.x, y: box.y, width: box.width, height: box.height, color: style.color, size: parseFloat(style.fontSize), weight: parseInt(style.fontWeight, 10) };
          });
          if (info.width < 2 || info.height < 2 || info.y < 0 || info.y + info.height > 900) continue;
          // The rounded edge and border of a chip are not text, so the sample stays a few pixels inside the box.
          const inset = info.width > 40 && info.height > 14 ? 3 : 0;
          const hide = await page.addStyleTag({ content: "* { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }" });
          const shot = await page.screenshot({ clip: { x: Math.max(0, info.x) + inset, y: info.y + inset, width: Math.max(1, Math.min(info.width, width - Math.max(0, info.x)) - 2 * inset), height: Math.max(1, info.height - 2 * inset) } });
          await hide.evaluate((node) => (node as HTMLElement).remove());
          const worst = await page.evaluate(async ({ data, color }) => {
            const image = new Image();
            await new Promise((resolve) => { image.onload = resolve; image.src = `data:image/png;base64,${data}`; });
            const canvas = document.createElement("canvas");
            canvas.width = image.width; canvas.height = image.height;
            const context = canvas.getContext("2d")!;
            context.drawImage(image, 0, 0);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            const text = (color.match(/[\d.]+/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number);
            const channel = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
            const lum = (r: number, g: number, b: number) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
            const textLum = lum(text[0]!, text[1]!, text[2]!);
            const ratios: number[] = [];
            for (let i = 0; i < pixels.length; i += 4) {
              const a = lum(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!);
              ratios.push((Math.max(a, textLum) + 0.05) / (Math.min(a, textLum) + 0.05));
            }
            ratios.sort((p, q) => p - q);
            return ratios[Math.floor(ratios.length * 0.02)] ?? 21;
          }, { data: shot.toString("base64"), color: info.color });
          measured += 1;
          const large = info.size >= 24 || (info.size >= 18.66 && info.weight >= 700);
          const need = large ? 3 : 4.5;
          if (worst < need) failures.push(`${area.name} "${info.label}" ${worst.toFixed(2)} < ${need}`);
        }
      }
      expect(measured, "lines measured").toBeGreaterThan(3);
      expect(failures).toEqual([]);
    });
  }
}
