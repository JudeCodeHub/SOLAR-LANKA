"use client";

import { useQueries, useQuery } from "@tanstack/react-query";

import { createBrowserApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query/keys";

const api = createBrowserApi();

export const DASHBOARD_LIMIT = 50;
/** Offers are read for this many of the customer's newest active requests, one call each. */
export const OFFER_REQUESTS = 5;

/** The customer's newest requests, enough to count how many are active. */
export function useDashboardRequests() {
  return useQuery({
    queryKey: queryKeys.dashboardRequests,
    queryFn: () => unwrap(() => api.GET("/users/me/requests", { params: { query: { limit: DASHBOARD_LIMIT, offset: 0 } } })),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** The offers on each of the given requests. */
export function useOffersFor(requestIds: readonly string[]) {
  return useQueries({
    queries: requestIds.map((id) => ({
      queryKey: queryKeys.requestOffers(id),
      queryFn: () => unwrap(() => api.GET("/users/me/requests/{request_id}/quotations", { params: { path: { request_id: id } } })),
      staleTime: 0,
    })),
  });
}

/** The company's newest enquiries, enough to count the ones not yet opened. */
export function useDashboardInbox(companyId: string) {
  return useQuery({
    queryKey: queryKeys.dashboardInbox(companyId),
    queryFn: () =>
      unwrap(() =>
        api.GET("/companies/{company_id}/request-deliveries", {
          params: { path: { company_id: companyId }, query: { limit: DASHBOARD_LIMIT, offset: 0 } },
        }),
      ),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useDashboardInstallations(companyId: string) {
  return useQuery({
    queryKey: queryKeys.dashboardInstallations(companyId),
    queryFn: () =>
      unwrap(() =>
        api.GET("/companies/{company_id}/installations", {
          params: { path: { company_id: companyId }, query: { limit: DASHBOARD_LIMIT, offset: 0 } },
        }),
      ),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
