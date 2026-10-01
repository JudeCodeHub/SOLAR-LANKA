/**
 * Moving from a saved estimate to preparing a quotation request. The estimate is named in the
 * address, so the page can be bookmarked or reloaded; it is only ever an id, and the page asks the
 * API for the estimate (which answers only for its owner), never trusting what the address claims.
 */
import { isProductId } from "../catalogue/links.ts";

export const PREPARE_PATH = "/my/requests/new";

export function prepareHref(estimateId: string): string {
  return `${PREPARE_PATH}?estimate=${encodeURIComponent(estimateId)}`;
}

export type EstimateParam =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "ok"; id: string };

/** What the address says about the estimate: absent, not a usable id, or an id to look up. */
export function parseEstimateParam(raw: string | null | undefined): EstimateParam {
  const value = (raw ?? "").trim();
  if (value === "") return { kind: "none" };
  return isProductId(value) ? { kind: "ok", id: value } : { kind: "invalid" };
}
