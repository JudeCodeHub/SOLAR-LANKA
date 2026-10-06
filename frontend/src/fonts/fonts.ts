import localFont from "next/font/local";

/** Body and interface text. */
export const bodyFont = localFont({
  src: "./hanken-grotesk/hanken-grotesk-latin-wght-normal.woff2",
  variable: "--font-body",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: "Arial",
});

/** Display headlines: the landing hero is set in it, so it is preloaded and the first paint already has the right face. */
export const displayFont = localFont({
  src: [{ path: "./fraunces/fraunces-latin-opsz-normal.woff2", style: "normal", weight: "100 900" }],
  variable: "--font-display",
  display: "swap",
  preload: true,
  adjustFontFallback: "Times New Roman",
});

/** The italic of the display face, for emphasis; it is not preloaded and is only fetched when a page uses it. */
export const displayItalicFont = localFont({
  src: [{ path: "./fraunces/fraunces-latin-opsz-italic.woff2", style: "italic", weight: "100 900" }],
  variable: "--font-display-italic",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
});

/** Figures, units and codes. */
export const figureFont = localFont({
  src: [
    { path: "./ibm-plex-mono/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./ibm-plex-mono/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./ibm-plex-mono/ibm-plex-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-figures",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
});
