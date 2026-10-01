/**
 * Query keys in one place so invalidation after a mutation names exactly what it affects.
 * Keys start with the resource, then identifiers and filters, mirroring the API paths.
 */
export const queryKeys = {
  currentUser: ["users", "me"] as const,
  /** Every product the signed-in customer has saved (ids only), the single source for hearts. */
  favouriteIds: ["favourites", "ids"] as const,
  /** One page of the favourites view. */
  favouriteList: (page: number) => ["favourites", "list", page] as const,
  favouriteListAll: ["favourites", "list"] as const,
  /** One product's full record. The single cache entry for it, shared by everything that needs it. */
  product: (kind: "panel" | "inverter", id: string) => ["catalogue", kind, id] as const,
};
