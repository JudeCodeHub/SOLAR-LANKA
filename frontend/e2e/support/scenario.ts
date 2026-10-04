import { randomUUID } from "node:crypto";

import type { ApiResult } from "../fixtures.ts";
import type { IdentityName } from "../identities.ts";

type Api = (who: IdentityName, method: string, path: string, body?: unknown, headers?: Record<string, string>) => Promise<ApiResult>;

export interface AcceptedInstallation {
  sunbird: string;
  requestId: string;
  quotationId: string;
  revisionId: string;
  installationId: string;
}

/** A new request to the first demo company, answered with a sent offer and accepted by the customer, all through the API. */
export async function acceptedInstallation(api: Api, customer: IdentityName = "estimateCustomer"): Promise<AcceptedInstallation> {
  const me = (await api("sunbirdAdmin", "GET", "/users/me")).body as { memberships: { company_id: string }[] };
  const sunbird = me.memberships[0]?.company_id ?? "";
  const sent = await api(customer, "POST", "/users/me/requests", { district: "Colombo", details: `E2E scenario ${randomUUID()}`, company_ids: [sunbird] }, { "Idempotency-Key": randomUUID() });
  const request = sent.body as { id: string; deliveries: { id: string }[] };
  const base = `/companies/${sunbird}/request-deliveries/${request.deliveries[0]?.id}`;
  const quotationId = ((await api("sunbirdAdmin", "POST", `${base}/quotations`)).body as { id: string }).id;
  await api("sunbirdAdmin", "PUT", `${base}/quotations/${quotationId}/draft`, {
    lines: [{ kind: "charge", description: "Installation", quantity: "1", unit_price: "100000" }],
    discount_kind: "none",
    discount_value: "0.00",
    tax_rate_percent: "0",
    capacity_kwp: "3.000",
    warranty_terms: "Fictional warranty",
    exclusions: "None",
    validity_days: 30,
  });
  const revisionId = ((await api("sunbirdAdmin", "POST", `${base}/quotations/${quotationId}/send`)).body as { revision_id: string }).revision_id;
  const accepted = await api(customer, "POST", `/users/me/requests/${request.id}/quotations/${quotationId}/revisions/${revisionId}/accept`);
  return { sunbird, requestId: request.id, quotationId, revisionId, installationId: (accepted.body as { installation_id: string }).installation_id };
}

export interface SentOffer {
  sunbird: string;
  requestId: string;
  quotationId: string;
  revisionId: string;
}

/** A new request answered with a sent offer that nobody has accepted, valid for only a few days. */
export async function sentOffer(api: Api, customer: IdentityName = "estimateCustomer", validityDays = 2): Promise<SentOffer> {
  const me = (await api("sunbirdAdmin", "GET", "/users/me")).body as { memberships: { company_id: string }[] };
  const sunbird = me.memberships[0]?.company_id ?? "";
  const sent = await api(customer, "POST", "/users/me/requests", { district: "Colombo", details: `E2E reminder ${randomUUID()}`, company_ids: [sunbird] }, { "Idempotency-Key": randomUUID() });
  const request = sent.body as { id: string; deliveries: { id: string }[] };
  const base = `/companies/${sunbird}/request-deliveries/${request.deliveries[0]?.id}`;
  const quotationId = ((await api("sunbirdAdmin", "POST", `${base}/quotations`)).body as { id: string }).id;
  await api("sunbirdAdmin", "PUT", `${base}/quotations/${quotationId}/draft`, {
    lines: [{ kind: "charge", description: "Installation", quantity: "1", unit_price: "100000" }],
    discount_kind: "none",
    discount_value: "0.00",
    tax_rate_percent: "0",
    capacity_kwp: "3.000",
    warranty_terms: "Fictional warranty",
    exclusions: "None",
    validity_days: validityDays,
  });
  const revisionId = ((await api("sunbirdAdmin", "POST", `${base}/quotations/${quotationId}/send`)).body as { revision_id: string }).revision_id;
  return { sunbird, requestId: request.id, quotationId, revisionId };
}
