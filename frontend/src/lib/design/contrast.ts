/** WCAG 2.2 colour contrast, used to keep the design tokens readable. */

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a six digit hex colour such as #FBF8F3. */
export function luminance(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`Not a six digit hex colour: ${hex}`);
  const [red, green, blue] = [1, 3, 5].map((start) => channel(Number.parseInt(hex.slice(start, start + 2), 16)));
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

/** The contrast ratio between two colours, from 1 (identical) to 21 (black on white). */
export function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}
