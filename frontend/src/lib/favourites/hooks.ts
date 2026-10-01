"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createBrowserApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { queryKeys } from "@/lib/query/keys";

import { applyFavourite } from "./state";

const api = createBrowserApi();

type FavouriteIds = components["schemas"]["FavouriteIds"];

export const FAVOURITES_PAGE_SIZE = 12;

/**
 * Every product the customer has saved, as ids. This is the one place hearts read from, so a heart
 * on a card, on a product page and in the favourites view always agree. Pass `enabled: false`
 * unless the visitor is a signed-in customer, so nobody else triggers the request.
 */
export function useFavouriteIds(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.favouriteIds,
    queryFn: () => unwrap(() => api.GET("/users/me/favourites/ids")),
    enabled,
  });
}

/** One page of the favourites view, with the products' names. */
export function useFavouritesPage(page: number) {
  return useQuery({
    queryKey: queryKeys.favouriteList(page),
    queryFn: () =>
      unwrap(() =>
        api.GET("/users/me/favourites", {
          params: { query: { limit: FAVOURITES_PAGE_SIZE, offset: (page - 1) * FAVOURITES_PAGE_SIZE } },
        }),
      ),
  });
}

/**
 * Save or remove a favourite. The heart responds at once; if the server refuses (the limit, a
 * product that was retired, a lost session) the previous state is restored and the error is
 * shown. Either way the server's list is fetched again afterwards, so it always has the last word.
 */
export function useSetFavourite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, favourite }: { id: string; favourite: boolean }) =>
      favourite
        ? unwrap(() => api.PUT("/users/me/favourites/{product_id}", { params: { path: { product_id: id } } }))
        : unwrap(() => api.DELETE("/users/me/favourites/{product_id}", { params: { path: { product_id: id } } })),
    onMutate: async ({ id, favourite }) => {
      await client.cancelQueries({ queryKey: queryKeys.favouriteIds });
      const previous = client.getQueryData<FavouriteIds>(queryKeys.favouriteIds);
      if (previous) {
        client.setQueryData<FavouriteIds>(queryKeys.favouriteIds, {
          ...previous,
          product_ids: applyFavourite(previous.product_ids, id, favourite),
        });
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        client.setQueryData(queryKeys.favouriteIds, context.previous);
      }
    },
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.favouriteIds }),
        client.invalidateQueries({ queryKey: queryKeys.favouriteListAll }),
      ]);
    },
  });
}
