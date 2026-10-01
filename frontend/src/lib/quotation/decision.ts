/** Whether a customer can still accept or decline an exact revision, and why not, from freshly read state. */
import { messages } from "../../messages/index.ts";
import { offerState } from "./customer.ts";

export type Blocker = "replaced" | "expired" | "withdrawn" | "declined" | "accepted" | "other_accepted" | "request_ended";

export interface OfferRow {
  quotation_id: string;
  revision_id: string;
  status: string;
  valid_until: string | null;
}

/** The reason this exact revision can no longer be decided, or null while it still can. */
export function decisionBlocker(input: {
  requestStatus: string;
  offers: readonly OfferRow[];
  quotationId: string;
  revisionId: string;
  now: number;
}): Blocker | null {
  if (input.requestStatus !== "submitted") return "request_ended";
  const offer = input.offers.find((item) => item.quotation_id === input.quotationId);
  if (!offer) return null;
  if (offer.revision_id !== input.revisionId) return "replaced";
  const state = offerState(offer, input.now);
  if (state === "accepted") return "accepted";
  if (state === "declined") return "declined";
  if (state === "withdrawn") return "withdrawn";
  if (state === "expired") return "expired";
  if (state !== "active") return "replaced";
  const other = input.offers.some((item) => item.quotation_id !== input.quotationId && item.status === "accepted");
  return other ? "other_accepted" : null;
}

export function blockerText(blocker: Blocker | null): string {
  return messages.customerOffers.decide.blockers[blocker ?? "unknown"];
}
