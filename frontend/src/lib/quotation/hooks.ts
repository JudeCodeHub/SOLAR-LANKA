"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createBrowserApi } from "@/lib/api/client";
import { ApiError, unwrap } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { queryKeys } from "@/lib/query/keys";

import type { DraftPayload } from "./draft";

const api = createBrowserApi();

export type CurrentQuotation = components["schemas"]["CurrentQuotation"];

/** The enquiry's quotation and its current draft terms, or null when none has been started. */
export function useCurrentQuotation(companyId: string, deliveryId: string) {
  return useQuery({
    queryKey: queryKeys.quotationCurrent(companyId, deliveryId),
    queryFn: async (): Promise<CurrentQuotation | null> => {
      try {
        return await unwrap(() =>
          api.GET("/companies/{company_id}/request-deliveries/{delivery_id}/quotations/current", {
            params: { path: { company_id: companyId, delivery_id: deliveryId } },
          }),
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Start the enquiry's quotation as an empty draft. */
export function useStartDraft(companyId: string, deliveryId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrap(() =>
        api.POST("/companies/{company_id}/request-deliveries/{delivery_id}/quotations", {
          params: { path: { company_id: companyId, delivery_id: deliveryId } },
        }),
      ),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.quotationCurrent(companyId, deliveryId) }),
  });
}

/** Save the draft's terms; the server calculates every total from the lines. */
export function useSaveDraft(companyId: string, deliveryId: string, quotationId: string) {
  return useMutation({
    mutationFn: (body: DraftPayload) =>
      unwrap(() =>
        api.PUT("/companies/{company_id}/request-deliveries/{delivery_id}/quotations/{quotation_id}/draft", {
          params: { path: { company_id: companyId, delivery_id: deliveryId, quotation_id: quotationId } },
          body,
        }),
      ),
  });
}

export type Revision = components["schemas"]["QuotationRevisionView"];

/** Every revision of the quotation, newest first, exactly as stored (sent revisions are frozen). */
export function useRevisions(companyId: string, deliveryId: string, quotationId: string) {
  return useQuery({
    queryKey: queryKeys.quotationRevisions(companyId, deliveryId),
    queryFn: () =>
      unwrap(() =>
        api.GET("/companies/{company_id}/request-deliveries/{delivery_id}/quotations/{quotation_id}/revisions", {
          params: {
            path: { company_id: companyId, delivery_id: deliveryId, quotation_id: quotationId },
            query: { limit: 50, offset: 0 },
          },
        }),
      ),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** The mutations that move a quotation between states; each leaves the reading of the new state to the caller. */
export function useQuotationActions(companyId: string, deliveryId: string, quotationId: string) {
  const path = { company_id: companyId, delivery_id: deliveryId, quotation_id: quotationId };
  return {
    send: useMutation({
      mutationFn: () =>
        unwrap(() =>
          api.POST("/companies/{company_id}/request-deliveries/{delivery_id}/quotations/{quotation_id}/send", {
            params: { path },
          }),
        ),
    }),
    startRevision: useMutation({
      mutationFn: () =>
        unwrap(() =>
          api.POST("/companies/{company_id}/request-deliveries/{delivery_id}/quotations/{quotation_id}/revisions", {
            params: { path },
          }),
        ),
    }),
    withdraw: useMutation({
      mutationFn: (revisionId: string) =>
        unwrap(() =>
          api.POST(
            "/companies/{company_id}/request-deliveries/{delivery_id}/quotations/{quotation_id}/revisions/{revision_id}/withdraw",
            { params: { path: { ...path, revision_id: revisionId } } },
          ),
        ),
    }),
  };
}
