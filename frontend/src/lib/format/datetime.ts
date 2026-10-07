/** The one place dates and times are written: British order, 24-hour clock, Sri Lanka time unless a zone is given. */
export const DEFAULT_ZONE = "Asia/Colombo";

const parse = (iso: string): Date | null => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** "15 September 2026" in the zone, or an empty string when the value is not a date. */
export function formatDate(iso: string, zone: string = DEFAULT_ZONE): string {
  const date = parse(iso);
  return date ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: zone }).format(date) : "";
}

/** "15 Sep 2026, 14:30 GMT+5:30": the moment with its zone name, so nobody has to guess the clock. */
export function formatDateTime(iso: string, zone: string = DEFAULT_ZONE): string {
  const date = parse(iso);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", hour12: false, timeZone: zone });
  const name = new Intl.DateTimeFormat("en-GB", { timeZoneName: "short", timeZone: zone }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value ?? zone;
  return `${parts.format(date)} ${name}`;
}
