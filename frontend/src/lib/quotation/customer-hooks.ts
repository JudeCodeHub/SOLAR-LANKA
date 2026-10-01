"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createBrowserApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { queryKeys } from "@/lib/query/keys";

const api = createBrowserApi();

export type OfferSummary = components["schemas"]["CustomerQuotationSummary"];
export type SentRevision = components["schemas"]["QuotationRevisionView"];
export type Comparison = components["schemas"]["OfferComparison"];

/** Every offer on the customer's own request, including expired, declined and withdrawn ones. */
export function useRequestOffers(requestId: string) {
  return useQuery({
    queryKey: queryKeys.requestOffers(requestId),
    queryFn: () => unwrap(() => api.GET("/users/me/requests/{request_id}/quotations", { params: { path: { request_id: requestId } } })),
    // Offers change while the customer is away, so always ask again.
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** The sent revisions of one offer, newest first, exactly as the company sent them. */
export function useOfferHistory(requestId: string, quotationId: string) {
  return useQuery({
    queryKey: queryKeys.offerHistory(requestId, quotationId),
    queryFn: () =>
      unwrap(() =>
        api.GET("/users/me/requests/{request_id}/quotations/{quotation_id}/revisions", {
          params: { path: { request_id: requestId, quotation_id: quotationId }, query: { limit: 50, offset: 0 } },
        }),
      ),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** The offers that are open right now, side by side. */
export function useComparison(requestId: string) {
  return useQuery({
    queryKey: queryKeys.comparison(requestId),
    queryFn: () => unwrap(() => api.GET("/users/me/requests/{request_id}/quotations/compare", { params: { path: { request_id: requestId } } })),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Accepting or declining one exact revision; both re-read everything the screens show, whatever the outcome. */
export function useDecision(requestId: string, quotationId: string, revisionId: string) {
  const client = useQueryClient();
  const path = { request_id: requestId, quotation_id: quotationId, revision_id: revisionId };
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.requestOffers(requestId) }),
      client.invalidateQueries({ queryKey: queryKeys.comparison(requestId) }),
      client.invalidateQueries({ queryKey: queryKeys.request(requestId) }),
    ]);
  return {
    // A refusal is explained from the fresh state, so the re-read finishes before the caller hears about it.
    accept: useMutation({
      mutationFn: () =>
        unwrap(() => api.POST("/users/me/requests/{request_id}/quotations/{quotation_id}/revisions/{revision_id}/accept", { params: { path } })),
      onSettled: refresh,
    }),
    decline: useMutation({
      mutationFn: () =>
        unwrap(() => api.POST("/users/me/requests/{request_id}/quotations/{quotation_id}/revisions/{revision_id}/decline", { params: { path } })),
      onSettled: refresh,
    }),
  };
}

/** One accepted installation and its steps, for the customer who accepted it. */
export function useInstallation(id: string) {
  return useQuery({
    queryKey: queryKeys.installation(id),
    queryFn: () => unwrap(() => api.GET("/users/me/installations/{installation_id}", { params: { path: { installation_id: id } } })),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
