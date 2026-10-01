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

/** Every product the customer has saved, as ids. */
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

/** Save or remove a favourite. */
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
