import { format, messages, plural } from "../../messages/index.ts";

/** "2.5" for a single value, "2.5 to 3" for a real range; a range of one value is not a range. */
export function rangeText(low: string | number, high: string | number): string {
  const trim = (value: string | number) => {
    const text = String(value);
    return text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
  };
  const a = trim(low);
  const b = trim(high);
  return a === b ? a : format(messages.estimator.received.range, { low: a, high: b });
}

/** The one-line system size shown after a calculation. */
export function sizingSummary(sizing: {
  capacity_kwp: { minimum: string | number; maximum: string | number };
  panel_count: { minimum: number; maximum: number };
}): string {
  const count = sizing.panel_count.maximum;
  return format(plural(messages.estimator.received.sizing, count), {
    capacity: rangeText(sizing.capacity_kwp.minimum, sizing.capacity_kwp.maximum),
    panels: rangeText(sizing.panel_count.minimum, sizing.panel_count.maximum),
  });
}
