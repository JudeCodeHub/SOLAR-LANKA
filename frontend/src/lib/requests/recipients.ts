/** Choosing which companies receive a quotation request, and building the submission. */
import type { components } from "../api/schema";
import type { Requirements } from "./requirements.ts";

export const MAX_RECIPIENTS = 5;
/** The service a company must offer to be asked for a system quotation (the backend's rule). */
export const REQUIRED_SERVICE = "installation";

export type EligibleCompany = components["schemas"]["PublicCompanyResponse"];
export type RequestBody = components["schemas"]["QuotationRequestCreate"];

export type ToggleResult =
  | { outcome: "added" | "removed"; ids: string[] }
  | { outcome: "full"; ids: string[] };

/** Add or remove a company; adding a sixth is refused and the list is returned untouched. */
export function toggleRecipient(ids: readonly string[], id: string, max = MAX_RECIPIENTS): ToggleResult {
  if (ids.includes(id)) return { outcome: "removed", ids: ids.filter((existing) => existing !== id) };
  if (ids.length >= max) return { outcome: "full", ids: [...ids] };
  return { outcome: "added", ids: [...ids, id] };
}

export interface ResolvedRecipients {
  /** Chosen companies that are still eligible, in the order they were chosen. */
  listed: EligibleCompany[];
  /** Chosen ids that are no longer on the eligible list (a company stopped serving, or was withdrawn). */
  missing: string[];
}

export function resolveRecipients(
  ids: readonly string[],
  eligible: readonly EligibleCompany[],
): ResolvedRecipients {
  const byId = new Map(eligible.map((company) => [company.id, company]));
  const listed: EligibleCompany[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    const company = byId.get(id);
    if (company) listed.push(company);
    else missing.push(id);
  }
  return { listed, missing };
}

/** The exact request the backend receives. Unknown monthly use is omitted as null, never 0. */
export function buildRequestBody(requirements: Requirements, companyIds: readonly string[]): RequestBody {
  return {
    district: requirements.district,
    details: requirements.details,
    monthly_consumption_kwh: requirements.monthly_consumption_kwh,
    saved_estimate_id: requirements.estimate_id,
    company_ids: [...companyIds],
  };
}

/** Identifies the content of a submission. */
export function fingerprintOf(requirements: Requirements, companyIds: readonly string[]): string {
  return JSON.stringify({
    d: requirements.district,
    t: requirements.details,
    m: requirements.monthly_consumption_kwh,
    e: requirements.estimate_id,
    c: [...companyIds].sort(),
  });
}

/** Whether a failed submission may have reached the server. */
export function mayHaveBeenReceived(status: number): boolean {
  return status === 0 || status >= 500;
}
