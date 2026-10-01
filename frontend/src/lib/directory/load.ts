import "server-only";

import { cache } from "react";

import type { components } from "@/lib/api/schema";
import { serverApi } from "@/lib/api/server";

import { isCompanyId } from "./links";
import type { District, Service } from "./options";
import { PAGE_SIZE } from "./params";

export type PublicCompany = components["schemas"]["PublicCompanyResponse"];

export type DirectoryResult = { ok: true; items: PublicCompany[]; total: number } | { ok: false };

/** One page of approved companies. A backend problem is `ok: false`, never an exception. */
export async function loadDirectory(
  apiQuery: { district?: string; service?: string },
  page: number,
): Promise<DirectoryResult> {
  try {
    const api = await serverApi();
    const { data } = await api.GET("/public/companies", {
      params: {
        query: {
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
          // Already checked against the allowed values when the address was parsed.
          district: apiQuery.district as District | undefined,
          service: apiQuery.service as Service | undefined,
        },
      },
    });
    return data ? { ok: true, items: data.items, total: data.total } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export type CompanyResult =
  | { status: "ok"; company: PublicCompany }
  | { status: "not-found" }
  | { status: "error" };

/**
 * One approved company. Cached per request so the page and its metadata share one fetch. A
 * company that is unknown, not approved (the backend answers 404 for both) or whose address is
 * malformed is "not-found".
 */
export const loadCompany = cache(async (id: string): Promise<CompanyResult> => {
  if (!isCompanyId(id)) return { status: "not-found" };
  try {
    const api = await serverApi();
    const { data, response } = await api.GET("/public/companies/{company_id}", {
      params: { path: { company_id: id } },
    });
    if (response.status === 404 || response.status === 422) return { status: "not-found" };
    return data ? { status: "ok", company: data } : { status: "error" };
  } catch {
    return { status: "error" };
  }
});
