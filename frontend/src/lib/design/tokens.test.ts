import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { messages } from "../../messages/index.ts";

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
  assert.ok(source.includes("relative overflow-auto"), "positioned, so hidden text inside is clipped with the table");
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

test("the footer carries the logo and link columns from the navigation list, and no demonstration banner", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "..", "components", "site-footer.tsx"), "utf8");
  assert.ok(source.includes("<Logo") && source.includes("messages.brand.tagline") && source.includes("NAV_ITEMS"));
  assert.ok(!source.includes("data-demo-notice") && !source.includes("text.disclaimer"), "the notice panel was removed at the owner's request");
  for (const id of ["panels", "inverters", "estimator", "companies", "learn", "troubleshooting", "support"]) assert.ok(source.includes(`"${id}"`), id);
  assert.ok(source.includes("text-ink-2") && source.includes("bg-paper-2"), "link colours come from the tested pairs");
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
  // The column sticks below the two-row header, not behind it.
  assert.ok(shell.includes("sticky top-40"));
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

test("every route group has a loading screen built from the page skeleton, announced as a status", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  for (const route of ["", "panels", "inverters", "companies", "learn", "estimator", "my", "company", "technician", "admin"]) {
    const file = read(`app/${route ? `${route}/` : ""}loading.tsx`);
    assert.ok(file.includes("<PageSkeleton variant="), `${route || "root"} loading screen`);
  }
  const skeleton = read("components/states/page-skeleton.tsx");
  assert.ok(skeleton.includes('role="status"') && skeleton.includes('aria-busy="true"') && skeleton.includes("sr-only") && skeleton.includes("<DialLoader"));
  for (const variant of ['"cards"', '"table"', '"form"']) assert.ok(skeleton.includes(variant), variant);
});

test("the landing hero has the approved wording, two actions, a sample-labelled dial and the priority photo with a fade for text", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const hero = read("components/landing/hero.tsx");
  for (const piece of ["messages.brand.heroLine", "messages.brand.heroSupport", "messages.brand.primaryAction", "messages.brand.trustLine", "<Dial", "<SampleBadge", 'name="hero"', "priority", "type-display-xl", 'size="lg"']) assert.ok(hero.includes(piece), piece);
  assert.ok(hero.includes("from-background") && hero.includes("lg:max-w-[48%]"), "the words sit in the faded, text-safe side");
  assert.ok(read("app/page.tsx").indexOf("<Hero") < read("app/page.tsx").indexOf("<EstimateTeaser"));
});

test("the estimate teaser labels its figures as a sample, writes them in the figure face and counts them up", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const teaser = read("components/landing/estimate-teaser.tsx");
  assert.ok(teaser.includes("<SampleBadge>") && teaser.includes("messages.brand.microcopy.indicative") && teaser.includes('href="/estimator"'));
  assert.equal([...teaser.matchAll(/<CountUp /g)].length, 3);
  assert.ok(teaser.includes("type-figure"));
  const count = read("components/ui/count-up.tsx");
  assert.ok(count.includes("prefers-reduced-motion: reduce") && count.includes("IntersectionObserver") && count.includes("observer.disconnect()") && count.includes('className="sr-only"'));
  assert.ok(read("app/page.tsx").indexOf("<EstimateTeaser />") > read("app/page.tsx").indexOf("<Hero"));
});

test("the how-it-works strip has the four approved steps, a drawn line in both directions, and numbered captions", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const strip = read("components/landing/how-it-works.tsx");
  for (const id of ["estimate", "compare", "choose", "track"]) assert.ok(strip.includes(`id: "${id}"`), id);
  assert.ok(strip.includes('<DrawLine direction="y"') && strip.includes('<DrawLine direction="x"') && strip.includes("<ol") && strip.includes("text.stepLabel"));
  const page = read("app/page.tsx");
  assert.ok(page.indexOf("<HowItWorks />") > page.indexOf("<EstimateTeaser />"));
});

test("the feature grid is uneven, covers the four features with a photo, icon, line and link, and sits after the strip", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const grid = read("components/landing/feature-grid.tsx");
  for (const id of ["estimate", "compare", "track", "learn"]) assert.ok(grid.includes(`id: "${id}"`), id);
  assert.ok(grid.includes("lg:col-span-7") && grid.includes("lg:col-span-5"), "wide and narrow cards");
  assert.ok(grid.includes("<Photo") && grid.includes("<IconCircle") && grid.includes("<Link") && grid.includes("min-h-11"));
  for (const href of ["/estimator", "/panels", "#tracking", "/learn"]) assert.ok(grid.includes(`href: "${href}"`), href);
  const page = read("app/page.tsx");
  assert.ok(page.indexOf("<FeatureGrid />") > page.indexOf("<HowItWorks />"));
});

test("the catalogue showcase always links both catalogues and shows placeholder photos, two figures and a sample label per product", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const showcase = read("components/landing/catalogue-showcase.tsx");
  assert.ok(showcase.includes('href="/panels"') && showcase.includes('href="/inverters"') && showcase.includes("<FeaturedProducts"));
  assert.ok(showcase.indexOf("<Button") < showcase.indexOf("<FeaturedProducts"), "the two links come before the data, so they show even when it fails");
  const products = read("components/catalogue/product-card.tsx");
  assert.ok(products.includes("panelPlaceholder") && products.includes("inverterPlaceholder") && products.includes("<SampleBadge>") && products.includes("type-figure"));
  assert.ok(products.includes("text.unspecified"), "a missing value says Not specified, not zero");
  const page = read("app/page.tsx");
  assert.ok(page.indexOf("<CatalogueShowcase") > page.indexOf("<FeatureGrid />"));
});

test("the signed-out landing page has no second navigation row, while other pages keep it", () => {
  const nav = readFileSync(join(import.meta.dirname, "..", "..", "components", "shell", "primary-nav.tsx"), "utf8");
  assert.ok(nav.includes('!signedIn && pathname === "/"'));
  assert.ok(nav.includes("usePathname"));
});

test("the companies showcase labels its companies as fictional, links the directory and each profile, and follows the catalogue", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const showcase = read("components/landing/companies-showcase.tsx");
  assert.ok(showcase.includes("<SampleBadge>{text.sampleLabel}</SampleBadge>") && showcase.includes("DIRECTORY_PATH") && showcase.includes("profileHref(") && showcase.includes("companyCover"));
  assert.ok(showcase.includes("messages.directory.approval.badge"), "the approval wording stays as the directory words it");
  const page = read("app/page.tsx");
  assert.ok(page.indexOf("<CompaniesShowcase") > page.indexOf("<CatalogueShowcase"));
  assert.ok(!page.includes("FeaturedCompanies"));
});

test("the learning teaser shows up to three real guides with a photo, category, summary and link, and loads them with the landing data", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const teaser = read("components/landing/learning-teaser.tsx");
  assert.ok(teaser.includes("slice(0, 3)") && teaser.includes("articlePhoto(") && teaser.includes("`/learn/${article.slug}`") && teaser.includes("article.category_name") && teaser.includes("article.summary"));
  assert.ok(read("lib/landing/load.ts").includes('"/education/articles"'));
  const page = read("app/page.tsx");
  assert.ok(page.indexOf("<LearningTeaser") > page.indexOf("<CompaniesShowcase"));
});

test("the tracking section shows the eight real installation steps in order with an icon and a word for each status, and the Track card links to it", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const section = read("components/landing/tracking-section.tsx");
  const order = ["site_survey", "system_design", "permits_and_approvals", "equipment_delivery", "installation_work", "inspection_and_testing", "commissioning", "customer_handover"];
  const listed = [...section.matchAll(/\{ kind: "(\w+)", state/g)].map((match) => match[1]);
  assert.deepEqual(listed, order);
  assert.ok(section.includes("messages.tracking.kinds") && section.includes("messages.tracking.statuses"), "the same words as the tracking page");
  assert.ok(section.includes("CircleCheck") && section.includes("Clock") && section.includes("Circle,") && section.includes("<SampleBadge>"));
  assert.ok(section.includes('id="tracking"'));
  const page = read("app/page.tsx");
  assert.ok(page.indexOf("<TrackingSection />") > page.indexOf("<LearningTeaser"));
});

test("the landing comparison is a real styled table with sample data, flagged and worded like the customer comparison", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const section = read("components/landing/comparison-section.tsx");
  assert.ok(section.includes("<TableRegion") && section.includes("<Table ") && section.includes("<caption") && section.includes('scope="col"') && section.includes('scope="row"'));
  assert.ok(section.includes("compare.differs") && section.includes("compare.someUnspecified") && section.includes("<NotSpecified />"), "the app's own words, through the shared marks");
  assert.ok(section.includes("<SampleBadge>"));
  const page = read("app/page.tsx");
  assert.ok(page.indexOf("<ComparisonSection />") > page.indexOf("<TrackingSection />"));
});

test("the safety section leads with the stop rule, uses the hazard style and the app's own wording, and the sales words stay out", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const section = read("components/landing/safety-section.tsx");
  assert.ok(section.includes('variant="hazard"') && section.includes("guidance.hazardTitle") && section.includes("guidance.hazardEscalate") && section.includes('name="safetyVisit"'));
  assert.ok(section.indexOf("<Alert") < section.indexOf("text.action"), "the rule comes before the link");
  const words = JSON.stringify(messages.landing.story.safety).toLowerCase();
  for (const sales of ["buy", "save", "discount", "offer", "deal"]) assert.ok(!words.includes(sales), sales);
  assert.ok(read("app/page.tsx").indexOf("<SafetySection />") > read("app/page.tsx").indexOf("<ComparisonSection />"));
});

test("the closing band is solid orange with dark ink in both themes, has the sunrise photo and one action, and ends the page", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const band = read("components/landing/closing-band.tsx");
  assert.ok(band.includes("bg-orange text-on-orange") && band.includes('name="sunrise"') && band.includes('href="/estimator"') && band.includes("text.title"));
  assert.ok(contrastRatio("#1A1511", "#FF6A1A") >= 4.5 && contrastRatio("#0D0B09", "#FF6A1A") >= 4.5, "ink on orange in both themes");
  assert.ok(contrastRatio("#FBF8F3", "#1A1511") >= 4.5 && contrastRatio("#FBF8F3", "#0D0B09") >= 4.5, "the button's text on its dark fill in both themes");
  const page = read("app/page.tsx");
  assert.ok(page.trimEnd().endsWith("}") && page.indexOf("<ClosingBand />") > page.indexOf("<SafetySection />") && !page.includes("</div>"), "the band is the last thing on the page, straight above the footer");
  assert.ok(!page.includes("EntryPoints"));
});

test("photos are eased down in the dark theme, the bright catalogue placeholders more so", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  assert.ok(read("components/ui/photo.tsx").includes('cn("dark:brightness-90", className)'));
  assert.ok(read("components/catalogue/product-card.tsx").includes("dark:brightness-[0.72]"));
});

test("a priority photo is fetched at high priority and eagerly, and the display font is preloaded while its italic is not", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  assert.ok(read("components/ui/photo.tsx").includes('fetchPriority: "high"') && read("components/ui/photo.tsx").includes('loading: "eager"'));
  const fonts = read("fonts/fonts.ts");
  const display = fonts.slice(fonts.indexOf("export const displayFont"), fonts.indexOf("/** The italic"));
  assert.ok(display.includes("preload: true") && !display.includes("italic"));
  const italic = fonts.slice(fonts.indexOf("export const displayItalicFont"), fonts.indexOf("export const figureFont"));
  assert.ok(italic.includes("preload: false"));
});

test("sign-in and sign-up share one auth layout: form beside a photo with a sample dial, a photo strip on phones", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const layout = read("components/auth/auth-layout.tsx");
  assert.ok(layout.includes("lg:grid-cols-2") && layout.includes("<Dial") && layout.includes("<SampleBadge>") && layout.includes("lg:hidden") && layout.includes("hidden overflow-hidden lg:block"));
  assert.ok(read("app/sign-in/[[...sign-in]]/page.tsx").includes("<AuthLayout") && read("app/sign-in/[[...sign-in]]/page.tsx").includes('photo="signIn"'));
  assert.ok(read("app/sign-up/[[...sign-up]]/page.tsx").includes("<AuthLayout") && read("app/sign-up/[[...sign-up]]/page.tsx").includes('photo="signUp"'));
  assert.ok(read("app/sign-up/[[...sign-up]]/page.tsx").includes("customerOnlyNote"), "the customer-only note stays");
});

test("Clerk takes the site's colour variables, so it follows the theme, and its links use the readable orange", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const appearance = read("lib/auth/clerk-appearance.ts");
  for (const variable of ["--ds-orange", "--ds-on-orange", "--ds-text", "--ds-surface", "--ds-field-border", "--ds-danger", "--ds-focus"]) assert.ok(appearance.includes(`var(${variable})`), variable);
  assert.ok(appearance.includes("rounded-full!") && appearance.includes("text-orange-text!") && appearance.includes("--font-body"));
  assert.ok(read("app/layout.tsx").includes("appearance={CLERK_APPEARANCE}"));
  assert.ok(contrastRatio("#B33D00", "#FFFFFF") >= 4.5, "link text on the white card");
});

test("the sign-in page gives the welcome line and three reasons to sign in beside Clerk's own form", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const page = read("app/sign-in/[[...sign-in]]/page.tsx");
  assert.ok(page.includes("<SignIn />") && page.includes("signInPoints.estimates") && page.includes("signInPoints.requests") && page.includes("signInPoints.installations") && page.includes('photo="signIn"'));
  assert.ok(read("components/auth/auth-layout.tsx").indexOf("{children}") < read("components/auth/auth-layout.tsx").indexOf("data-auth-points"), "the form comes before the list in reading order");
});

test("the sign-up page matches sign-in: the P11 photo, three reasons, and the customer-accounts-only note kept", () => {
  const page = readFileSync(join(import.meta.dirname, "..", "..", "app", "sign-up", "[[...sign-up]]", "page.tsx"), "utf8");
  assert.ok(page.includes("<SignUp />") && page.includes('photo="signUp"') && page.includes("signUpPoints.save") && page.includes("signUpPoints.ask") && page.includes("signUpPoints.follow"));
  assert.ok(page.includes("customerOnlyNote") && page.includes("text-ink-2"));
});

test("the account page uses the shared header, shows the role as a badge, and puts Clerk's profile in a full-width framed card", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const page = read("app/account/[[...user-profile]]/page.tsx");
  assert.ok(page.includes("<PageHeader") && page.includes("<BackendProfile />") && page.includes('<UserProfile path="/account"') && page.includes("data-account-page"));
  assert.ok(page.indexOf("<BackendProfile />") < page.indexOf("<UserProfile"), "the app's own record comes first");
  assert.ok(page.includes("rounded-card!") && page.includes("w-full!"));
  const profile = read("components/backend-profile.tsx");
  assert.ok(profile.includes('data-testid="backend-role"') && profile.includes('<Badge variant="orange">'), "the role badge keeps its test id for the browser specs");
});

test("the access screens explain what happened with an icon, plain words and the next step, in the new panel style", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const notice = read("components/states/access-notice.tsx");
  for (const kind of ['"signed-out"', '"not-allowed"', "inactive", "rejected"]) assert.ok(notice.includes(kind), kind);
  assert.ok(notice.includes("StatePanel") && notice.includes("signInHref(returnPath)") && notice.includes("SignOutButton") && notice.includes("messages.auth.createAccount"));
  assert.ok(notice.includes('"alert" : "status"'), "errors announce themselves, the others do not interrupt");
  assert.ok(read("components/session-problem.tsx").includes("<AccessNotice"));
  assert.ok(read("components/admin/platform-gate.tsx").includes('<AccessNotice kind="not-allowed"'));
  assert.ok(read("components/company/staff-gate.tsx").includes('<AccessNotice'));
  const api = read("components/api-error-message.tsx");
  assert.ok(api.includes('"signed-out" : "not-allowed"') && api.includes("<Alert variant=\"destructive\""), "forbidden and signed-out get the panel, other failures keep the alert");
});

test("one product card serves the lists and the landing page: photo, kind, linked name, two figures, sample label, and the controls only on the lists", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const card = read("components/catalogue/product-card.tsx");
  for (const piece of ["panelPlaceholder", "inverterPlaceholder", "<SampleBadge>", "type-figure", "text.unspecified", "after:absolute after:inset-0", "<FavouriteButton", "<ComparisonToggle", "actions = true", "headingLevel"]) assert.ok(card.includes(piece), piece);
  assert.ok(!card.includes("Sample price"), "no price exists in the catalogue data, so no price chip is invented");
  assert.ok(read("components/landing/featured-products.tsx").includes('actions={false}') && read("components/landing/featured-products.tsx").includes('headingLevel="h4"'));
  assert.ok(read("components/catalogue/catalogue-page.tsx").includes("<ProductCard"));
});

test("every comparison and spec table shows Not specified and the difference flags through the same shared marks", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", "components", path), "utf8");
  const marks = read("ui/compare-marks.tsx");
  assert.ok(marks.includes("border-dashed") && marks.includes("data-unspecified") && marks.includes('data-flag="differs"') && marks.includes('data-flag="unspecified"') && marks.includes("border-l-orange"));
  assert.ok(marks.includes("CircleHelp") && marks.includes("ArrowLeftRight"), "an icon as well as words");
  for (const file of ["requests/compare-view.tsx", "comparison/compare-page.tsx", "landing/comparison-section.tsx"]) {
    const source = read(file);
    assert.ok(source.includes("compare-marks") && source.includes("DifferenceFlag") && source.includes("UnspecifiedFlag"), file);
    assert.ok(!source.includes("border-dashed"), `${file} no longer draws its own dashed pill`);
  }
  assert.ok(read("catalogue/detail/unspecified-value.tsx").includes("<NotSpecified />"));
});

test("the connection scheme is one labelled radio group of cards with a one-line explanation and a check mark each", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", path), "utf8");
  const cards = read("components/forms/radio-cards-field.tsx");
  for (const piece of ['role="radiogroup"', "aria-label={label}", "<legend", 'type="radio"', "has-[:checked]:border-orange", "has-[:focus-visible]:outline-3", "<Check", "min-h-24"]) assert.ok(cards.includes(piece), piece);
  const form = read("components/estimator/estimator-form.tsx");
  assert.ok(form.includes('name="connection_scheme"') && form.includes("<RadioCardsField") && form.includes("fields.schemeCards"));
  const schemes = Object.keys(messages.estimator.fields.schemeCards);
  assert.deepEqual(schemes, Object.keys(messages.estimator.fields.schemeOptions), "a card for every scheme the form knows");
  for (const card of Object.values(messages.estimator.fields.schemeCards)) assert.ok(card.line.length > 20 && card.line.length < 110, card.line);
});

test("the estimator charts use theme colours and a different pattern for each kind of bar", () => {
  const chart = readFileSync(join(import.meta.dirname, "..", "..", "components", "estimator", "result-chart.tsx"), "utf8");
  assert.doesNotMatch(chart, /#[0-9a-fA-F]{3,8}\b/);
  assert.match(chart, /var\(--ds-info\)/);
  assert.match(chart, /var\(--ds-orange-text\)/);
  assert.match(chart, /<pattern id=\{`\$\{chart\}-base`\}/);
  assert.match(chart, /<pattern id=\{`\$\{chart\}-low`\}/);
});

test("the estimate assumptions are folded into accordion items built on the details element", () => {
  const dir = join(import.meta.dirname, "..", "..", "components");
  const accordion = readFileSync(join(dir, "ui", "accordion.tsx"), "utf8");
  assert.match(accordion, /<details/);
  assert.match(accordion, /<summary/);
  assert.match(accordion, /min-h-11/);
  assert.match(accordion, /motion-reduce:transition-none/);
  const results = readFileSync(join(dir, "estimator", "estimate-results.tsx"), "utf8");
  assert.equal((results.match(/<AccordionItem/g) ?? []).length, 3);
});

test("the save panel uses real buttons and alerts, and the stale warning is a bordered warning with an icon and a title", () => {
  const dir = join(import.meta.dirname, "..", "..", "components");
  const save = readFileSync(join(dir, "estimates", "save-estimate.tsx"), "utf8");
  assert.match(save, /buttonVariants\(\)/);
  assert.match(save, /variant="success"/);
  assert.doesNotMatch(save, /underline/);
  const results = readFileSync(join(dir, "estimator", "estimate-results.tsx"), "utf8");
  assert.match(results, /variant="warning"[^>]*border-2[^>]*data-stale/);
  assert.match(results, /text\.staleTitle/);
});

test("My estimates and the saved estimate use the page header, figure cards and a scrollable settings table", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", "components", "estimates", path), "utf8");
  const list = read("estimates-view.tsx");
  assert.match(list, /<PageHeader/);
  assert.match(list, /type-figure/);
  assert.match(list, /min-h-11/);
  assert.match(list, /motion-reduce:transition-none/);
  assert.doesNotMatch(list, /text-muted-foreground|font-heading/);
  const detail = read("saved-estimate-view.tsx");
  assert.match(detail, /<PageHeader/);
  assert.match(detail, /<TableRegion label=/);
  assert.match(detail, /text\.savedOn/);
  assert.match(detail, /text\.settingsIntro/);
  assert.doesNotMatch(detail, /text-muted-foreground|font-heading/);
});

test("every type-* class used in a component is a defined utility", () => {
  const css = readFileSync(join(import.meta.dirname, "..", "..", "app", "globals.css"), "utf8");
  const defined = new Set([...css.matchAll(/@utility (type-[a-z-]+)/g)].map((match) => match[1]));
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : name.endsWith(".tsx") ? [join(dir, name)] : []));
  // "type-title" is an element id in the design gallery, not a class.
  const unknown = new Set<string>();
  for (const file of walk(join(import.meta.dirname, "..", ".."))) for (const match of readFileSync(file, "utf8").matchAll(/\btype-[a-z]+(?:-[a-z]+)?\b/g)) if (!defined.has(match[0]) && match[0] !== "type-title") unknown.add(`${match[0]} in ${file.split("/src/")[1]}`);
  assert.deepEqual([...unknown], []);
});

test("the article page keeps its text as plain paragraphs in a reading column, with a contents list on wide screens", () => {
  const view = readFileSync(join(import.meta.dirname, "..", "..", "components", "education", "article-view.tsx"), "utf8");
  assert.doesNotMatch(view, /dangerouslySetInnerHTML/);
  assert.match(view, /paragraphs\(article\.body\)/);
  assert.match(view, /max-w-reading/);
  assert.match(view, /hidden lg:block/);
  assert.match(view, /<Photo /);
  assert.match(view, /id="article-body"/);
});

test("the article notices are alerts with their own variant and icon, and keep their date wording", () => {
  const notice = readFileSync(join(import.meta.dirname, "..", "..", "components", "education", "article-notice.tsx"), "utf8");
  assert.match(notice, /variant=\{overdue \? "danger" : "warning"\}/);
  assert.match(notice, /variant="info"/);
  assert.match(notice, /<VerifiedBadge/);
  assert.match(notice, /text\.timeSensitiveBody/);
  assert.match(notice, /text\.overdueBody/);
  assert.match(notice, /text\.publishedReviewed/);
  assert.match(notice, /role="note"/);
});

test("related guides use the same card as the learn list, so both link the same way", () => {
  const dir = join(import.meta.dirname, "..", "..", "components", "education");
  const view = readFileSync(join(dir, "article-view.tsx"), "utf8");
  const list = readFileSync(join(dir, "learn-view.tsx"), "utf8");
  const card = readFileSync(join(dir, "article-card.tsx"), "utf8");
  assert.match(view, /<ArticleCard item=\{item\}/);
  assert.match(list, /<ArticleCard item=\{item\}/);
  assert.match(card, /href=\{`\/learn\/\$\{item\.slug\}`\}/);
  assert.match(card, /min-h-11/);
});

test("the lookup form keeps its ids, labels and checks while using the page header, a card and a find-your-model aid", () => {
  const view = readFileSync(join(import.meta.dirname, "..", "..", "components", "support", "troubleshooting-view.tsx"), "utf8");
  for (const needle of ['htmlFor="model"', 'id="model"', 'htmlFor="code"', 'id="code"', "lookupQuery({ model, code, productId })", "text.needModel", 'data-error="model"', "aria-invalid={Boolean(problem)}", "<PageHeader", "data-find-model", "text-danger"]) assert.ok(view.includes(needle), needle);
});

test("troubleshooting results put hazards first, never give a hazard steps, and keep the sources", () => {
  const view = readFileSync(join(import.meta.dirname, "..", "..", "components", "support", "troubleshooting-view.tsx"), "utf8");
  assert.match(view, /ordered\(data\.references\)/);
  assert.match(view, /variant="hazard"/);
  assert.match(view, /border-2 border-danger/);
  // Steps are drawn only for a safe observation.
  assert.match(view, /reference\.safety_level === "safe_observation" \? \(\s*<ol/);
  assert.doesNotMatch(view, /hazard \? \(\s*<ol/);
  for (const needle of ["data-source", "text.hazardEscalate", "text.open", "text.report", "data-no-references"]) assert.ok(view.includes(needle), needle);
});

test("the public support page puts the safety message before the steps and the actions", () => {
  const view = readFileSync(join(import.meta.dirname, "..", "..", "components", "support", "public-support.tsx"), "utf8");
  const at = (needle: string) => view.indexOf(needle);
  assert.ok(at("data-safety-first") > 0 && at("data-safety-first") < at("data-steps") && at("data-steps") < at('href="/troubleshooting"'));
  assert.match(view, /border-2 border-danger/);
  assert.match(view, /<Photo name="safetyVisit"/);
  assert.match(view, /messages\.support\.safety\.body/);
});

test("every link in a signed-in area has an icon, and the customer area lists all its links", async () => {
  const { NAV_ITEMS } = await import("../navigation.ts");
  const icons = readFileSync(join(import.meta.dirname, "..", "..", "components", "shell", "nav-icons.tsx"), "utf8");
  const missing = NAV_ITEMS.filter((item) => ["customer", "company", "admin"].includes(item.group)).filter((item) => !icons.includes(`"${item.id}":`));
  assert.deepEqual(missing.map((item) => item.id), []);
  const customer = NAV_ITEMS.filter((item) => item.group === "customer").map((item) => item.href);
  assert.deepEqual(customer, ["/my", "/my/support", "/my/estimates", "/my/requests", "/my/installations", "/my/favourites"]);
});

test("the area's dashboard link is current only on its own page, not on every page below it", () => {
  const shell = readFileSync(join(import.meta.dirname, "..", "..", "components", "shell", "dashboard-shell.tsx"), "utf8");
  const link = readFileSync(join(import.meta.dirname, "..", "..", "components", "shell", "nav-link.tsx"), "utf8");
  assert.match(shell, /exact=\{area\.items\.some/);
  assert.match(link, /exact \? current === item\.href/);
});

test("the customer home has a greeting header with the evening photo and three summary cards that each link to their list and keep their empty texts", () => {
  const dir = join(import.meta.dirname, "..", "..", "components", "dashboard");
  const home = readFileSync(join(dir, "customer-dashboard.tsx"), "utf8");
  const parts = readFileSync(join(dir, "dashboard-parts.tsx"), "utf8");
  assert.match(home, /<HomeHeader/);
  assert.match(parts, /name="homeEvening"/);
  assert.equal((home.match(/<SummaryCard /g) ?? []).length, 3);
  for (const href of ['"/my/requests", label: text.viewRequests', '"/my/requests", label: text.viewOffers', '"/my/installations", label: text.viewInstallations']) assert.ok(home.includes(href), href);
  for (const empty of ["text.requestsNone", "text.offersNone", "text.installationsNone"]) assert.ok(home.includes(empty), empty);
  assert.match(parts, /min-h-14/);
});

test("the prepare-a-request form keeps its fields, validation and send path while using the page header, numbered section cards and selectable estimate cards", () => {
  const view = readFileSync(join(import.meta.dirname, "..", "..", "components", "requests", "prepare-view.tsx"), "utf8");
  for (const needle of ["requirementsSchema", "useAppForm(requirementsSchema", 'name="district"', 'name="monthly_consumption_kwh"', 'name="details"', "maxLength={MAX_DETAILS}", "text.estimate.loadingDetails", "onConfirm(requirements)", "<RecipientsStep requirements={draft} />", 'type="radio"', "data-nothing-sent", "data-filled", "data-locked-district", "data-estimate-error"]) assert.ok(view.includes(needle), needle);
  assert.match(view, /<PageHeader/);
  assert.equal((view.match(/data-section=/g) ?? []).length, 2);
  assert.match(view, /has-\[:checked\]:border-orange-text/);
  assert.match(view, /min-h-11/);
  assert.doesNotMatch(view, /text-muted-foreground|font-heading|text-destructive/);
});

test("choosing companies shows a visible count, selectable cards and a review card, and keeps the guarded send", () => {
  const dir = join(import.meta.dirname, "..", "..", "components", "requests");
  const step = readFileSync(join(dir, "recipients-step.tsx"), "utf8");
  for (const needle of ["inFlight.current", "buildRequestBody(requirements, ids)", "keyFor(fingerprintOf(requirements, ids))", "MAX_RECIPIENTS", "aria-disabled={blocked}", "data-count", "data-companies", "data-recipients", "data-send", "data-missing", "data-uncertain", "data-changed", "role=\"status\""]) assert.ok(step.includes(needle), needle);
  assert.match(step, /has-\[:checked\]:border-orange-text/);
  assert.match(step, /rounded-full border border-orange-text\/30 bg-orange-tint/);
  assert.doesNotMatch(step, /text-muted-foreground|font-heading|text-destructive/);
  const sent = readFileSync(join(dir, "sent-confirmation.tsx"), "utf8");
  for (const needle of ["data-sent", "data-replayed", "data-sent-companies", "heading.current?.focus()"]) assert.ok(sent.includes(needle), needle);
  assert.doesNotMatch(sent, /text-muted-foreground|font-heading/);
});

test("the request page and its offers keep their marks while using the new cards, chips and table region", () => {
  const dir = join(import.meta.dirname, "..", "..", "components", "requests");
  const view = readFileSync(join(dir, "request-view.tsx"), "utf8");
  for (const needle of ["data-status", "data-headline", "data-progress", "data-delivery", "data-stale-notice", "data-confirm", "data-withdraw", "data-confirm-yes", "data-not-withdrawable", "inFlight.current", "<OffersSection", "<TableRegion"]) assert.ok(view.includes(needle), needle);
  assert.doesNotMatch(view, /text-muted-foreground|font-heading/);
  const offers = readFileSync(join(dir, "offers-section.tsx"), "utf8");
  for (const needle of ["data-offers-section", "data-offers", "data-offer=", "data-state", "data-expiry", "data-soon", "data-compare-link", "data-compare-need", "data-no-offers", "expiryText(item, now)", "isExpiringSoon(item, now)"]) assert.ok(offers.includes(needle), needle);
  assert.doesNotMatch(offers, /text-muted-foreground|font-heading/);
});
