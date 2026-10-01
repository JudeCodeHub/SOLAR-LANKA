import { format, messages } from "../../messages/index.ts";

/** "2.5" for a single value, "2.5 to 3" for a real range; a range of one value is not a range. */
export function rangeText(low: string | number, high: string | number): string {
  const trim = (value: string | number) => {
    const text = String(value);
    return text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
  };
  const a = trim(low);
  const b = trim(high);
  return a === b ? a : format(messages.estimator.results.range, { low: a, high: b });
}
