/** Moving from a saved estimate to preparing a quotation request. */
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
