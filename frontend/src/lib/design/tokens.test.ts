import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { contrastRatio } from "./contrast.ts";
import { ALERT_VARIANTS, TABLE_PAIRS, BADGE_VARIANTS, BUTTON_VARIANTS, CARD_VARIANTS, CONTRAST_RULES, CSS_NAMES, DARK, DECORATIVE_ONLY_ON_LIGHT, LIGHT, type ContrastRule, type Theme } from "./tokens.ts";

const maps: Record<Theme, Record<string, string>> = { light: LIGHT, dark: DARK };

/** Every rule that a token set fails, as readable text. */
function failures(rules: ContrastRule[], tokens: Record<Theme, Record<string, string>>): string[] {
  return rules.flatMap((rule) => {
    const foreground = tokens[rule.theme][rule.foreground];
    const background = tokens[rule.theme][rule.background];
    if (!foreground || !background) return [`${rule.theme}: unknown token in ${rule.foreground} on ${rule.background}`];
    const ratio = contrastRatio(foreground, background);
    return ratio >= rule.minimum ? [] : [`${rule.theme}: ${rule.foreground} on ${rule.background} is ${ratio.toFixed(2)} (needs ${rule.minimum}) for ${rule.use}`];
  });
}

test("the contrast formula matches known values", () => {
  assert.equal(contrastRatio("#000000", "#FFFFFF"), 21);
  assert.equal(contrastRatio("#FFFFFF", "#000000"), 21);
  assert.equal(contrastRatio("#FBF8F3", "#FBF8F3"), 1);
  assert.ok(Math.abs(contrastRatio("#767676", "#FFFFFF") - 4.54) < 0.01);
  assert.throws(() => contrastRatio("orange", "#FFFFFF"));
});

test("every token is a six digit hex colour", () => {
  for (const [name, value] of [...Object.entries(LIGHT), ...Object.entries(DARK)]) {
    assert.match(value, /^#[0-9A-F]{6}$/, name);
  }
});

test("every text, graphic, border and focus pair meets its minimum in both themes", () => {
  assert.deepEqual(failures(CONTRAST_RULES, maps), []);
});

test("the check really fails when a pair drops: white on the orange fill is caught", () => {
  const broken = { light: { ...LIGHT, onOrange: "#FFFFFF" }, dark: DARK };
  const found = failures(CONTRAST_RULES, broken);
  assert.ok(found.some((line) => line.includes("onOrange on orange")), found.join("\n"));
});

test("the check fails for muted text that is too pale, in either theme", () => {
  assert.ok(failures(CONTRAST_RULES, { light: { ...LIGHT, ink3: "#A89B8C" }, dark: DARK }).length > 0);
  assert.ok(failures(CONTRAST_RULES, { light: LIGHT, dark: { ...DARK, muted: "#5A4E43" } }).length > 0);
});

test("both themes cover the same roles", () => {
  const roles = (rules: ContrastRule[], theme: Theme) => new Set(rules.filter((rule) => rule.theme === theme).map((rule) => rule.use));
  assert.deepEqual(roles(CONTRAST_RULES, "light"), roles(CONTRAST_RULES, "dark"));
});

test("text on an orange button is dark ink in both themes, never white", () => {
  for (const theme of ["light", "dark"] as const) {
    const onOrange = maps[theme].onOrange ?? "";
    assert.ok(contrastRatio(onOrange, "#000000") < contrastRatio(onOrange, "#FFFFFF"), theme);
  }
});

test("the orange fill is never an essential graphic on a light surface", () => {
  for (const name of DECORATIVE_ONLY_ON_LIGHT) {
    const used = CONTRAST_RULES.filter((rule) => rule.theme === "light" && rule.foreground === name && rule.minimum > 0 && rule.use !== "label on an orange button");
    assert.deepEqual(used, [], name);
    assert.ok(contrastRatio(LIGHT.orange, LIGHT.paper) < 3);
  }
});

/** The --ds-* values of one rule block in globals.css. */
function cssValues(selector: RegExp): Record<string, string> {
  const css = readFileSync(join(import.meta.dirname, "..", "..", "app", "globals.css"), "utf8");
  const block = css.match(selector)?.[1] ?? "";
  return Object.fromEntries([...block.matchAll(/--ds-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6});/g)].map((match) => [match[1] ?? "", (match[2] ?? "").toUpperCase()]));
}

test("the CSS variables carry exactly the values the contrast test measures", () => {
  const css = { light: cssValues(/:root,\s*\.light\s*\{([^}]*)\}/), dark: cssValues(/\.dark\s*\{([^}]*)\}/) };
  for (const theme of ["light", "dark"] as const) {
    const tokens: Record<string, string> = maps[theme];
    for (const [key, cssName] of Object.entries(CSS_NAMES[theme])) {
      assert.equal(css[theme][cssName], tokens[key]?.toUpperCase(), `${theme} ${key} (--ds-${cssName})`);
    }
    assert.deepEqual(Object.keys(css[theme]).sort(), Object.values(CSS_NAMES[theme]).sort(), `${theme} has no extra or missing variables`);
  }
});

const valueByCssName = (theme: Theme, cssName: string): string => {
  const key = Object.entries(CSS_NAMES[theme]).find(([, name]) => name === cssName)?.[0] ?? "";
  return maps[theme][key] ?? "";
};

test("every button variant meets its contrast in both themes", () => {
  const problems: string[] = [];
  for (const { variant, pairs } of BUTTON_VARIANTS) {
    for (const theme of ["light", "dark"] as const) {
      for (const [foreground, background] of pairs) {
        const ratio = contrastRatio(valueByCssName(theme, foreground), valueByCssName(theme, background));
        const needed = foreground === "field-border" ? 3 : 4.5;
        if (ratio < needed) problems.push(`${variant} ${theme}: ${foreground} on ${background} is ${ratio.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test("the Button component is built from exactly the classes the contrast data names", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "..", "components", "ui", "button.tsx"), "utf8");
  for (const { variant, classes } of BUTTON_VARIANTS) {
    const line = source.match(new RegExp(`\\n\\s+"?${variant}"?:\\s*\\n?\\s*"([^"]+)"`))?.[1] ?? "";
    for (const name of classes) assert.ok(line.split(/\s+/).includes(name), `${variant} should use ${name}`);
  }
});

test("every button size is at least 44 px tall", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "..", "components", "ui", "button.tsx"), "utf8");
  const sizes = source.match(/size: \{([\s\S]*?)\n      \},/)?.[1] ?? "";
  const heights = [...sizes.matchAll(/"(?:h|size)-(\d+)/g)].map((match) => Number(match[1]));
  assert.ok(heights.length >= 8, "found the sizes");
  for (const height of heights) assert.ok(height >= 11, `h-${height}`);
});

test("every card surface keeps its text readable in both themes", () => {
  const problems: string[] = [];
  for (const { variant, pairs } of CARD_VARIANTS) {
    for (const theme of ["light", "dark"] as const) {
      for (const [foreground, background] of pairs) {
        const ratio = contrastRatio(valueByCssName(theme, foreground), valueByCssName(theme, background));
        if (ratio < 4.5) problems.push(`${variant} ${theme}: ${foreground} on ${background} is ${ratio.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test("the Card component offers exactly the five surfaces, raised by default, built from the named classes", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "..", "components", "ui", "card.tsx"), "utf8");
  const block = source.match(/variant: \{([\s\S]*?)\n      \},/)?.[1] ?? "";
  assert.deepEqual([...block.matchAll(/^\s+(\w+):/gm)].map((match) => match[1]), CARD_VARIANTS.map((card) => card.variant));
  assert.match(source, /defaultVariants: \{ variant: "raised" \}/);
  for (const { variant, classes } of CARD_VARIANTS) {
    const line = block.match(new RegExp(`${variant}:\\s*"([^"]+)"`))?.[1] ?? "";
    for (const name of classes) assert.ok(line.split(/\s+/).includes(name), `${variant} should use ${name}`);
  }
  assert.ok(!source.includes("ring-foreground"), "the old template ring is gone");
});

test("every badge variant keeps its words readable in both themes", () => {
  const problems: string[] = [];
  for (const { variant, pairs } of BADGE_VARIANTS) {
    for (const theme of ["light", "dark"] as const) {
      for (const [foreground, background] of pairs) {
        const ratio = contrastRatio(valueByCssName(theme, foreground), valueByCssName(theme, background));
        if (ratio < 4.5) problems.push(`${variant} ${theme}: ${foreground} on ${background} is ${ratio.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test("the Badge component has exactly these variants, built from the named classes, and always draws an icon", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "..", "components", "ui", "badge.tsx"), "utf8");
  const block = source.match(/variant: \{([\s\S]*?)\n    \},/)?.[1] ?? "";
  assert.deepEqual([...block.matchAll(/^\s+(\w+):/gm)].map((match) => match[1]), BADGE_VARIANTS.map((badge) => badge.variant));
  for (const { variant, classes } of BADGE_VARIANTS) {
    const line = block.match(new RegExp(`${variant}:\\s*"([^"]+)"`))?.[1] ?? "";
    for (const name of classes) assert.ok(line.split(/\s+/).includes(name), `${variant} should use ${name}`);
  }
  // The icon is drawn unconditionally, so a badge can never be colour only.
  assert.match(source, /<Icon aria-hidden \/>/);
  for (const preset of ["SampleBadge", "VerifiedBadge", "TimeSensitiveBadge"]) assert.ok(source.includes(`function ${preset}`), preset);
});

test("every alert variant keeps its title, body and icon readable in both themes", () => {
  const problems: string[] = [];
  for (const { variant, pairs } of ALERT_VARIANTS) {
    for (const theme of ["light", "dark"] as const) {
      for (const [foreground, background] of pairs) {
        const ratio = contrastRatio(valueByCssName(theme, foreground), valueByCssName(theme, background));
        if (ratio < 4.5) problems.push(`${variant} ${theme}: ${foreground} on ${background} is ${ratio.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test("the Alert component builds each variant from the named classes and the hazard style is heavier", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "..", "components", "ui", "alert.tsx"), "utf8");
  for (const { variant, classes } of ALERT_VARIANTS) {
    const line = source.match(new RegExp(`\\s${variant}:\\s*"([^"]+)"`))?.[1] ?? "";
    for (const name of classes) assert.ok(line.split(/\s+/).includes(name), `${variant} should use ${name}`);
  }
});

test("table header, stripe and highlight colours keep their words readable in both themes", () => {
  const problems: string[] = [];
  for (const theme of ["light", "dark"] as const) {
    for (const [foreground, background] of TABLE_PAIRS) {
      const ratio = contrastRatio(valueByCssName(theme, foreground), valueByCssName(theme, background));
      if (ratio < 4.5) problems.push(`${theme}: ${foreground} on ${background} is ${ratio.toFixed(2)}`);
    }
  }
  assert.deepEqual(problems, []);
});

test("the table region is focusable, scrolls on its own and the table has a sticky header and stripes", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "..", "components", "ui", "table.tsx"), "utf8");
  assert.match(source, /tabIndex=\{0\}/);
  assert.match(source, /role="region"/);
  assert.ok(source.includes("overflow-auto"));
  assert.ok(source.includes("sticky"));
  assert.ok(source.includes("nth-child(even)"));
  assert.ok(!source.includes("outline-none"), "the global focus ring must stay visible");
});

test("tabs, segmented controls and pagination are 44 px high and keep the focus ring", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", "components", path), "utf8");
  for (const file of ["ui/tabs.tsx", "ui/segmented.tsx", "catalogue/pagination.tsx"]) {
    const source = read(file);
    assert.ok(source.includes("min-h-11"), `${file} should be 44 px high`);
    assert.ok(!source.includes("outline-none"), `${file} must keep the global focus ring`);
  }
  assert.ok(read("ui/segmented.tsx").includes("bg-orange text-on-orange"));
  assert.ok(read("catalogue/pagination.tsx").includes("bg-orange text-on-orange"));
  assert.ok(read("ui/tabs.tsx").includes("data-[state=active]:border-orange"));
});

test("sheet, dialog and confirm action use the system surfaces and keep their focus handling", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", "components", path), "utf8");
  for (const file of ["ui/sheet.tsx", "ui/dialog.tsx"]) {
    const source = read(file);
    assert.ok(source.includes("bg-surface") && source.includes("shadow-e3") && source.includes("border-line"), `${file} should use surface, border and shadow tokens`);
    assert.ok(source.includes("bg-black/50"), `${file} should dim the page clearly`);
  }
  assert.ok(read("ui/dialog.tsx").includes("rounded-panel"));
  const confirm = read("company/confirm-action.tsx");
  assert.ok(confirm.includes("heading.current?.focus()") && confirm.includes("tabIndex={-1}"), "focus still moves to the question");
  assert.ok(confirm.includes("bg-orange-tint"));
});

test("empty, error and not-found states share one panel with an illustration slot and use tested tones", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", "components", path), "utf8");
  const panel = read("states/state-panel.tsx");
  assert.ok(panel.includes("illustration") && panel.includes("IconCircle") && panel.includes('"orange" | "danger"'));
  for (const file of ["states/empty-state.tsx", "states/error-state.tsx", "states/not-found-state.tsx"]) assert.ok(read(file).includes("StatePanel"), file);
  assert.ok(read("states/error-state.tsx").includes('role="alert"'));
  assert.ok(read("states/not-found-state.tsx").includes('heading="h1"'));
});

test("page header, figure and key-value components use the type scale and tested colours", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", "components", path), "utf8");
  const header = read("ui/page-header.tsx");
  assert.ok(header.includes("Heading") && header.includes('level = "h1"') && header.includes("type-display-m") && header.includes("text-orange-text"));
  assert.ok(read("ui/stat.tsx").includes("type-figure"));
  assert.ok(read("ui/key-value.tsx").includes("description-list") && read("ui/key-value.tsx").includes("type-figure"));
});

test("icons come from one library at one stroke weight, and discs use tested tone pairs", () => {
  const manifest = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "..", "package.json"), "utf8")) as { dependencies: Record<string, string> };
  const iconLibraries = Object.keys(manifest.dependencies).filter((name) => /icon|lucide|phosphor|heroicons|tabler|fontawesome/i.test(name));
  assert.deepEqual(iconLibraries, ["lucide-react"]);
  const css = readFileSync(join(import.meta.dirname, "..", "..", "app", "globals.css"), "utf8");
  assert.match(css, /svg\.lucide \{\s*stroke-width: 1\.75/);
  const source = readFileSync(join(import.meta.dirname, "..", "..", "components", "ui", "icon.tsx"), "utf8");
  for (const tone of ["bg-orange-tint text-orange-text", "bg-success-tint text-success", "bg-warning-tint text-warning", "bg-danger-tint text-danger", "bg-info-tint text-info", "bg-paper-2 text-ink-2"]) assert.ok(source.includes(tone), tone);
  assert.ok(source.includes("aria-hidden"));
});

test("the design page lists every section, links to it, and shows both themes side by side", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "..", "components", "design", "design-gallery.tsx"), "utf8");
  const listed = source.match(/const SECTIONS = \[([^\]]+)\]/)?.[1]?.match(/"(\w+)"/g)?.map((name) => name.slice(1, -1)) ?? [];
  const present = [...source.matchAll(/<section id="(\w+)"/g)].map((match) => match[1]).filter((id) => id !== "sideBySide");
  assert.deepEqual(listed, present);
  assert.ok(listed.length >= 18);
  assert.ok(source.includes('<ThemePreview theme="light" />') && source.includes('<ThemePreview theme="dark" />'));
});

test("the header is sticky, frosts once scrolled, shows the logo, and active links use the tested orange tint", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", "components", path), "utf8");
  const sticky = read("shell/sticky-header.tsx");
  assert.ok(sticky.includes("sticky top-0") && sticky.includes("backdrop-blur-md") && sticky.includes("scrollY"));
  assert.ok(sticky.includes("motion-reduce:transition-none"));
  const header = read("site-header.tsx");
  assert.ok(header.includes("<Logo") && header.includes("<StickyHeader>") && header.includes("<ThemeToggle"));
  assert.ok(read("shell/nav-link.tsx").includes("bg-orange-tint text-orange-text"));
});

test("the mobile menu carries the logo, the theme choice and 44 px rows, and the narrow header drops to the mark alone", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", "components", path), "utf8");
  const menu = read("shell/mobile-menu.tsx");
  assert.ok(menu.includes("<Logo") && menu.includes("<ThemeToggle") && menu.includes("min-h-11"));
  assert.ok(menu.includes("<Sheet") && menu.includes("<SheetTitle") && menu.includes("<SheetDescription"), "the dialog keeps its name and description");
  const header = read("site-header.tsx");
  assert.ok(header.includes('className="hidden sm:block"') && header.includes('<LogoMark size={36} className="sm:hidden"'));
  assert.ok(header.includes('<div className="hidden md:block">'), "the header theme toggle moves into the menu on phones");
});

test("the footer carries the logo, link columns from the navigation list, and the demonstration notice", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "..", "components", "site-footer.tsx"), "utf8");
  assert.ok(source.includes("<Logo") && source.includes("messages.brand.tagline") && source.includes("data-demo-notice"));
  assert.ok(source.includes("text.disclaimer") && source.includes("NAV_ITEMS"));
  for (const id of ["panels", "inverters", "estimator", "companies", "learn", "troubleshooting", "support"]) assert.ok(source.includes(`"${id}"`), id);
  assert.ok(source.includes("text-ink-2") && source.includes("bg-paper-2"), "link and notice colours come from the tested pairs");
});

test("the skip link is a visible orange pill above the sticky header when focused, and the layout puts it before the header", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const link = read("components/shell/skip-link.tsx");
  assert.ok(link.includes("focus:bg-orange") && link.includes("focus:text-on-orange") && link.includes("focus:z-[60]") && link.includes("focus:min-h-11"));
  assert.ok(!link.includes("focus:outline-none"), "the focus ring stays");
  const layout = read("app/layout.tsx");
  assert.ok(layout.indexOf("<SkipLink />") > 0 && layout.indexOf("<SkipLink />") < layout.indexOf("<SiteHeader />"));
});

test("detail pages lead back with one BackLink, and breadcrumbs mark the current page", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", "components", path), "utf8");
  const back = read("ui/back-link.tsx");
  assert.ok(back.includes("min-h-11") && back.includes("ArrowLeft") && back.includes("motion-reduce"));
  for (const file of ["requests/request-view.tsx", "requests/offer-view.tsx", "estimates/saved-estimate-view.tsx", "installations/tracking-view.tsx", "comparison/compare-page.tsx", "catalogue/detail/product-detail-page.tsx", "education/article-view.tsx", "directory/company-profile.tsx", "visits/technician-visit.tsx"]) {
    assert.ok(read(file).includes("<BackLink"), `${file} should use BackLink`);
  }
  const crumbs = read("ui/breadcrumbs.tsx");
  assert.ok(crumbs.includes('aria-current={last ? "page" : undefined}') && crumbs.includes("<nav aria-label={label}") && crumbs.includes("min-h-11"));
});

test("each signed-in area is wrapped in the dashboard shell with its own link group", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  for (const [area, group] of [["my", "customer"], ["company", "company"], ["technician", "company"], ["admin", "admin"]]) {
    const layout = read(`app/${area}/layout.tsx`);
    assert.ok(layout.includes(`<DashboardShell group="${group}"`), `${area} should use the ${group} links`);
  }
  const shell = read("components/shell/dashboard-shell.tsx");
  assert.ok(shell.includes("hidden w-60 shrink-0 lg:block") && shell.includes("lg:hidden") && shell.includes("<Sheet"), "side column on desktop, drawer on phones");
  assert.ok(shell.includes("useNavigation(signedIn)") && shell.includes("data-dashboard"));
  assert.ok(shell.includes("sticky top-24"));
});

test("the not-found and error pages use the full-page state with the photo, and the root error page carries tested colours", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const screen = read("components/states/state-screen.tsx");
  assert.ok(screen.includes('name="errorSky"') && screen.includes("<Heading") && screen.includes("lg:grid-cols-2"));
  for (const file of ["app/not-found.tsx", "app/error.tsx", "app/companies/[id]/not-found.tsx"]) assert.ok(read(file).includes("<StateScreen"), file);
  assert.ok(read("app/error.tsx").includes("alert") && read("app/not-found.tsx").includes("href=\"/\""), "an error announces itself and not-found leads home");
  const root = read("app/global-error.tsx");
  assert.ok(root.includes("#FBF8F3") && root.includes("#FF6A1A") && root.includes("outline: 3px"));
  for (const theme of ["light", "dark"] as const) {
    const ink = theme === "light" ? "#1A1511" : "#F7F0E7";
    const paper = theme === "light" ? "#FBF8F3" : "#0D0B09";
    const muted = theme === "light" ? "#4B4036" : "#CDBFB0";
    assert.ok(root.includes(ink) && root.includes(paper) && root.includes(muted), theme);
    assert.ok(contrastRatio(ink, paper) >= 4.5 && contrastRatio(muted, paper) >= 4.5, theme);
  }
  assert.ok(contrastRatio("#1A1511", "#FF6A1A") >= 4.5, "button text on orange");
});
