"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createBrowserApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { queryKeys } from "@/lib/query/keys";

const api = createBrowserApi();

export const SAVED_PAGE_SIZE = 12;

type Request = components["schemas"]["EstimatorInputs-Input"];

/** One page of the customer's saved estimates, newest first, straight from the API. */
export function useSavedEstimates(page: number) {
  return useQuery({
    queryKey: queryKeys.estimateList(page),
    queryFn: () =>
      unwrap(() =>
        api.GET("/users/me/estimates", {
          params: { query: { limit: SAVED_PAGE_SIZE, offset: (page - 1) * SAVED_PAGE_SIZE } },
        }),
      ),
  });
}

/** One saved estimate with its inputs, result and the settings it was calculated with. */
export function useSavedEstimate(id: string) {
  return useQuery({
    queryKey: queryKeys.estimate(id),
    queryFn: () => unwrap(() => api.GET("/users/me/estimates/{estimate_id}", { params: { path: { estimate_id: id } } })),
    // A saved estimate never changes, so there is nothing to refetch in the background.
    staleTime: Infinity,
  });
}

/** Save the inputs of a calculation; the server recalculates and stores the snapshot. */
export function useSaveEstimate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Request) => unwrap(() => api.POST("/users/me/estimates", { body })),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.estimateListAll }),
  });
}
