/** Turning what a person types into explicit time slots, and showing stored slots in the visit's own time zone. */
import { format, messages } from "../../messages/index.ts";

const text = messages.visits;

export const ZONE = "Asia/Colombo";
/** Colombo has no daylight saving, so its offset is always +05:30. */
const COLOMBO_OFFSET = "+05:30";
export const MAX_SLOTS = 3;

export interface SlotRow {
  date: string;
  start: string;
  end: string;
}

export const emptyRow = (): SlotRow => ({ date: "", start: "", end: "" });

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Problems per row index and field, and the request slots when there are none. */
export function slotRequest(rows: readonly SlotRow[]): { errors: Record<string, string>; slots: { starts_at: string; ends_at: string }[] } {
  const errors: Record<string, string> = {};
  rows.forEach((row, index) => {
    const key = (field: string) => `${index}.${field}`;
    if (!DATE.test(row.date) || Number.isNaN(Date.parse(row.date))) errors[key("date")] = text.errors.date;
    if (!TIME.test(row.start)) errors[key("start")] = text.errors.time;
    if (!TIME.test(row.end)) errors[key("end")] = text.errors.time;
    if (!errors[key("start")] && !errors[key("end")] && row.end <= row.start) errors[key("end")] = text.errors.order;
  });
  if (rows.length === 0) errors.slots = text.errors.noSlots;
  if (Object.keys(errors).length > 0) return { errors, slots: [] };
  return { errors, slots: rows.map((row) => ({ starts_at: `${row.date}T${row.start}:00${COLOMBO_OFFSET}`, ends_at: `${row.date}T${row.end}:00${COLOMBO_OFFSET}` })) };
}

/** "Saturday 10 October 2026, 09:00 to 11:00" in the given zone. */
export function formatRange(startIso: string, endIso: string, zone: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const day = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: zone }).format(start);
  const time = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone: zone, hour12: false }).format(d);
  return format(text.range, { day, from: time(start), to: time(end) });
}

export function statusLabel(status: string): string {
  return (text.statuses as Record<string, string>)[status] ?? status;
}

export function actionLabel(action: string): string {
  return (text.actions as Record<string, string>)[action] ?? action;
}

/** Which controls each side is offered, mirroring the backend's table of allowed actions. */
export function customerCan(status: string): { accept: boolean; reschedule: boolean; cancel: boolean } {
  return { accept: status === "alternatives_offered", reschedule: ["requested", "alternatives_offered", "confirmed"].includes(status), cancel: ["requested", "alternatives_offered", "confirmed"].includes(status) };
}

export function staffCan(status: string): { confirm: boolean; propose: boolean; cancel: boolean } {
  return { confirm: status === "requested", propose: status === "requested" || status === "confirmed", cancel: ["requested", "alternatives_offered", "confirmed"].includes(status) };
}

/** A visit can be completed once it is confirmed and its start time has passed. */
export function canComplete(visit: { status: string; confirmed_starts_at: string | null }, now: number): boolean {
  return visit.status === "confirmed" && visit.confirmed_starts_at !== null && Date.parse(visit.confirmed_starts_at) <= now;
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}
