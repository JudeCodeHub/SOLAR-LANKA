/** How a sent request is described to its customer, and when it can be withdrawn. */
import { format, messages, plural } from "../../messages/index.ts";

export interface DeliveryLike {
  id: string;
  company_id: string;
  status: string;
  created_at: string;
  viewed_at: string | null;
}
export interface RequestLike {
  status: string;
  deliveries: readonly DeliveryLike[];
}

const text = messages.requests;
const requestStatuses: Record<string, string> = text.status;
const deliveryStatuses: Record<string, string> = text.delivery;

/** The wording for a request's status; an unknown status is shown as written, never dropped. */
export function requestStatusLabel(status: string): string {
  return requestStatuses[status] ?? status;
}

export function deliveryStatusLabel(status: string): string {
  return deliveryStatuses[status] ?? status;
}

export interface Counts {
  total: number;
  waiting: number;
  opened: number;
  responding: number;
  closed: number;
  cancelled: number;
}

/** How many companies are at each stage. `opened` counts those that have viewed it and not gone further. */
export function countDeliveries(deliveries: readonly DeliveryLike[]): Counts {
  const counts: Counts = { total: deliveries.length, waiting: 0, opened: 0, responding: 0, closed: 0, cancelled: 0 };
  for (const delivery of deliveries) {
    if (delivery.status === "submitted") counts.waiting += 1;
    else if (delivery.status === "viewed") counts.opened += 1;
    else if (delivery.status === "responding") counts.responding += 1;
    else if (delivery.status === "closed") counts.closed += 1;
    else if (delivery.status === "cancelled") counts.cancelled += 1;
  }
  return counts;
}

export type ChipTone = "info" | "success" | "neutral";

/** The chip on a request: its state in the same words as before, and "Preparing a response" once a company is answering. */
export function requestChip(request: RequestLike): { label: string; tone: ChipTone; state: "sent" | "responding" | "closed" | "withdrawn" | "other" } {
  if (request.status === "closed") return { label: requestStatusLabel("closed"), tone: "neutral", state: "closed" };
  if (request.status === "cancelled") return { label: requestStatusLabel("cancelled"), tone: "neutral", state: "withdrawn" };
  if (request.status === "submitted") {
    if (countDeliveries(request.deliveries).responding > 0) return { label: deliveryStatusLabel("responding"), tone: "success", state: "responding" };
    return { label: requestStatusLabel("submitted"), tone: "info", state: "sent" };
  }
  return { label: requestStatusLabel(request.status), tone: "neutral", state: "other" };
}

/** One sentence on where the request stands. */
export function headline(request: RequestLike): string {
  const t = text.headline;
  if (request.status === "cancelled") return t.withdrawn;
  if (request.status === "closed") return t.closed;
  const counts = countDeliveries(request.deliveries);
  if (counts.responding > 0) return format(plural(t.responding, counts.responding), { count: counts.responding });
  // Companies that opened it and went further (responding or closed) have opened it too.
  const opened = counts.opened + counts.closed;
  if (opened === 0) return t.waiting;
  return counts.total === 1 ? t.openedOne : format(t.opened, { opened, total: counts.total });
}

export type NotWithdrawable = "withdrawn" | "closed" | "responding" | "other";
export type Withdrawal = { eligible: true } | { eligible: false; reason: NotWithdrawable };

/** Whether the request can be withdrawn, and if not, why. */
export function withdrawal(request: RequestLike): Withdrawal {
  if (request.status === "cancelled") return { eligible: false, reason: "withdrawn" };
  if (request.status === "closed") return { eligible: false, reason: "closed" };
  if (request.status !== "submitted") return { eligible: false, reason: "other" };
  if (request.deliveries.some((delivery) => delivery.status === "responding" || delivery.status === "closed")) {
    return { eligible: false, reason: "responding" };
  }
  return { eligible: true };
}

/** What to tell the customer after a withdrawal was refused, from the request's fresh state. */
export function staleMessage(fresh: RequestLike | undefined): string {
  const t = text.withdraw.stale;
  if (!fresh) return t.other;
  const state = withdrawal(fresh);
  if (state.eligible) return t.other;
  return t[state.reason === "withdrawn" ? "withdrawn" : state.reason === "closed" ? "closed" : state.reason === "responding" ? "responding" : "other"];
}
