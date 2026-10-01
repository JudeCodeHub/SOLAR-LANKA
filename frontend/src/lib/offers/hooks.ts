"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createBrowserApi } from "@/lib/api/client";
import { ApiError, unwrap } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { queryKeys } from "@/lib/query/keys";

import type { OfferChanges, OfferValues } from "./offer";
import { createBody } from "./offer";

const api = createBrowserApi();

export type Offer = components["schemas"]["OfferResponse"];
export type Product = components["schemas"]["ProductDetail"];

export const OFFERS_LIMIT = 100;

/** The company's own offers. Only its staff are answered; the backend scopes them to the company. */
export function useOffers(companyId: string) {
  return useQuery({
    queryKey: queryKeys.companyOffers(companyId),
    queryFn: () =>
      unwrap(() =>
        api.GET("/companies/{company_id}/offers", {
          params: { path: { company_id: companyId }, query: { limit: OFFERS_LIMIT, offset: 0 } },
        }),
      ),
    staleTime: 0,
  });
}

export function useCreateOffer(companyId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, values }: { productId: string; values: OfferValues }) =>
      unwrap(() =>
        api.POST("/companies/{company_id}/offers", {
          params: { path: { company_id: companyId } },
          body: createBody(productId, values),
        }),
      ),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.companyOffers(companyId) }),
  });
}

export function useUpdateOffer(companyId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ offerId, changes }: { offerId: string; changes: OfferChanges }) =>
      unwrap(() =>
        api.PATCH("/companies/{company_id}/offers/{offer_id}", {
          params: { path: { company_id: companyId, offer_id: offerId } },
          body: changes,
        }),
      ),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.companyOffers(companyId) }),
  });
}

/** A catalogue product by id, for showing what an offer is for. */
export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.productLookup(id),
    queryFn: async (): Promise<Product | null> => {
      for (const kind of ["panels", "inverters"] as const) {
        try {
          return await unwrap(() =>
            kind === "panels"
              ? api.GET("/catalogue/panels/{product_id}", { params: { path: { product_id: id } } })
              : api.GET("/catalogue/inverters/{product_id}", { params: { path: { product_id: id } } }),
          );
        } catch (error) {
          if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 422)) throw error;
        }
      }
      return null;
    },
    staleTime: 5 * 60_000,
  });
}

export const SEARCH_LIMIT = 12;

/** Catalogue products to choose from when adding an offer. */
export function useCatalogueSearch(kind: "panel" | "inverter", search: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.catalogueSearch(kind, search),
    enabled,
    // A product can be retired at any time; every search asks again so it is never offered stale.
    staleTime: 0,
    queryFn: () =>
      unwrap(() =>
        kind === "panel"
          ? api.GET("/catalogue/panels", { params: { query: { search: search || undefined, limit: SEARCH_LIMIT } } })
          : api.GET("/catalogue/inverters", { params: { query: { search: search || undefined, limit: SEARCH_LIMIT } } }),
      ),
  });
}
