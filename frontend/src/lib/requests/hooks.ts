"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import { createBrowserApi } from "@/lib/api/client";
import { ApiError, ensureApiError, toApiError, unwrap } from "@/lib/api/errors";
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
  const client = useQueryClient();
  return useMutation({
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.requestListAll }),
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

export const REQUESTS_PAGE_SIZE = 12;

/** One page of the customer's sent requests, newest first. */
export function useRequests(page: number) {
  return useQuery({
    queryKey: queryKeys.requestList(page),
    queryFn: () =>
      unwrap(() =>
        api.GET("/users/me/requests", {
          params: { query: { limit: REQUESTS_PAGE_SIZE, offset: (page - 1) * REQUESTS_PAGE_SIZE } },
        }),
      ),
    // Progress changes while the customer is away, so always ask again when returning to the list.
    staleTime: 0,
  });
}

/** One request with each company's progress. Always asked for again on return, and on window focus. */
export function useRequest(id: string) {
  return useQuery({
    queryKey: queryKeys.request(id),
    queryFn: () => unwrap(() => api.GET("/users/me/requests/{request_id}", { params: { path: { request_id: id } } })),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Withdraw a request. The server decides; afterwards the request and the list are read again. */
export function useWithdrawRequest(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(() => api.POST("/users/me/requests/{request_id}/withdraw", { params: { path: { request_id: id } } })),
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.request(id) });
      await client.invalidateQueries({ queryKey: queryKeys.requestListAll });
    },
  });
}

/** Public names for the companies a request went to: a name, or null when the company is no longer listed. */
export function useCompanyNames(ids: readonly string[]): Map<string, string | null | undefined> {
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.companyName(id),
      queryFn: async (): Promise<string | null> => {
        try {
          const company = await unwrap(() =>
            api.GET("/public/companies/{company_id}", { params: { path: { company_id: id } } }),
          );
          return company.name;
        } catch (error) {
          // A company that is not (or no longer) approved is simply not listed.
          if (error instanceof ApiError && (error.status === 404 || error.status === 422)) return null;
          throw error;
        }
      },
      staleTime: 5 * 60_000,
    })),
  });
  return new Map(ids.map((id, index) => [id, results[index]?.data]));
}
