/** Rules for the company enquiry inbox: wording, which actions are open, and what to say when they are not. */
import { z } from "zod";

import { messages } from "../../messages/index.ts";
import { deliveryStatusLabel } from "../requests/progress.ts";

const text = messages.company.inbox;
const companyStatuses: Record<string, string> = text.status;

export interface DeliveryLike {
  status: string;
}

/** The company's own wording for an enquiry's status; an unknown status is shown as written. */
export function companyStatusLabel(status: string): string {
  return companyStatuses[status] ?? status;
}

export type EnquiryTone = "orange" | "info" | "success" | "neutral";

/** The colour family of an enquiry's chip: "New" stands out, the rest follow how far the work has got; the words always say the same thing. */
export function enquiryTone(status: string): EnquiryTone {
  if (status === "submitted") return "orange";
  if (status === "viewed") return "info";
  if (status === "responding") return "success";
  return "neutral";
}

/** What the customer sees on their request page for this status. */
export function customerSees(status: string): string {
  return deliveryStatusLabel(status);
}

/** An enquiry is active while it is new, opened or being responded to; the backend refuses writes after that. */
export function isActive(delivery: DeliveryLike): boolean {
  return delivery.status === "submitted" || delivery.status === "viewed" || delivery.status === "responding";
}

export interface Actions {
  canMarkOpened: boolean;
  canMarkResponding: boolean;
  canClose: boolean;
  canAddNote: boolean;
  /** Why nothing more can be done, when the enquiry is no longer active. */
  inactiveReason: "withdrawn" | "closed" | "other" | null;
}

export function availableActions(delivery: DeliveryLike): Actions {
  const active = isActive(delivery);
  return {
    canMarkOpened: delivery.status === "submitted",
    // Responding cannot go back to opened, so it is only offered before a response has started.
    canMarkResponding: delivery.status === "submitted" || delivery.status === "viewed",
    canClose: active,
    canAddNote: active,
    inactiveReason: active ? null : delivery.status === "cancelled" ? "withdrawn" : delivery.status === "closed" ? "closed" : "other",
  };
}

/** What to tell staff after a refused action, from the enquiry's fresh state rather than the error text. */
export function staleMessage(fresh: DeliveryLike | undefined): string {
  const t = text.stale;
  if (!fresh) return t.other;
  const reason = availableActions(fresh).inactiveReason;
  if (reason === "withdrawn") return t.withdrawn;
  if (reason === "closed") return t.closed;
  if (fresh.status === "responding") return t.responding;
  return t.other;
}

/** Who wrote a note, without exposing anything beyond whether it was the viewer. */
export function noteAuthor(authorId: string, viewerId: string | undefined): string {
  return authorId === viewerId ? text.notes.you : text.notes.colleague;
}

export const MAX_NOTE = 4000;

/** An internal note: required, trimmed, and no longer than the backend allows. */
export const noteSchema = z.object({
  body: z.string().trim().min(1, text.validation.noteRequired).max(MAX_NOTE),
});
