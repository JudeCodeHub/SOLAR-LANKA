/** Helpers for the count-up figures: a fixed, locale-free way to write a number so the server and the browser agree. */

/** Write a number with a comma between thousands and a fixed count of decimals, for example 7300 as "7,300". */
export function formatNumber(value: number, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole = "0", fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${value < 0 ? "-" : ""}${grouped}${fraction === undefined ? "" : `.${fraction}`}`;
}

/** The value part-way through an ease-out count from zero; `progress` runs from 0 to 1. */
export function countAt(target: number, progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return target * (1 - (1 - clamped) ** 3);
}
