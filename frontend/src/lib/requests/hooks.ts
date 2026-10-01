"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { createBrowserApi } from "@/lib/api/client";
import { ensureApiError, toApiError, unwrap } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import type { District } from "@/lib/directory/options";
import { queryKeys } from "@/lib/query/keys";

import { REQUIRED_SERVICE, type RequestBody } from "./recipients";

const api = createBrowserApi();

export const COMPANY_LIMIT = 100;

/** The approved companies that serve a district and offer installation: the only ones that may be chosen. */
export function useEligibleCompanies(district: string) {
  return useQuery({
    queryKey: queryKeys.eligibleCompanies(district),
    queryFn: () =>
      unwrap(() =>
        api.GET("/public/companies", {
          params: { query: { district: district as District, service: REQUIRED_SERVICE, limit: COMPANY_LIMIT } },
        }),
      ),
    // Eligibility can change between preparing and sending, so always ask again when returning.
    staleTime: 0,
  });
}

export interface Submitted {
  created: components["schemas"]["QuotationRequestCreated"];
  /** The server recognised the idempotency key and returned the original request (HTTP 200). */
  replayed: boolean;
}

/** Send the request. The idempotency key makes a retry return the original instead of a duplicate. */
export function useSubmitRequest() {
  return useMutation({
    mutationFn: async ({ body, key }: { body: RequestBody; key: string }): Promise<Submitted> => {
      let result;
      try {
        result = await api.POST("/users/me/requests", { body, params: { header: { "Idempotency-Key": key } } });
      } catch (error) {
        throw ensureApiError(error);
      }
      if (!result.response.ok || !result.data) throw toApiError(result.response, result.error);
      return { created: result.data, replayed: result.response.status === 200 };
    },
  });
}
