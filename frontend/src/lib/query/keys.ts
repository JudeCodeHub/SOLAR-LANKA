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
  /** Saved estimates: one page of the list, and one estimate in full. */
  estimateList: (page: number) => ["estimates", "list", page] as const,
  estimateChoices: ["estimates", "list", "choices"] as const,
  estimateListAll: ["estimates", "list"] as const,
  estimate: (id: string) => ["estimates", "detail", id] as const,
  /** A company's private profile and its review history (staff only). */
  companyProfile: (id: string) => ["company", id, "profile"] as const,
  companyReviews: (id: string) => ["company", id, "reviews"] as const,
  /** A company's own offers, a product looked up by id, and a catalogue search for adding an offer. */
  companyOffers: (id: string) => ["company", id, "offers"] as const,
  productLookup: (id: string) => ["catalogue", "lookup", id] as const,
  catalogueSearch: (kind: string, search: string) => ["catalogue", "search", kind, search] as const,
  /** Sent quotation requests: one page of the list, and one request with its progress. */
  requestList: (page: number) => ["requests", "list", page] as const,
  requestListAll: ["requests", "list"] as const,
  request: (id: string) => ["requests", "detail", id] as const,
  /** A company's public name, for showing who a request went to. */
  companyName: (id: string) => ["companies", "name", id] as const,
  /** Companies that can receive a request for a district. */
  eligibleCompanies: (district: string) => ["companies", "eligible", district] as const,
  /** One product's full record. The single cache entry for it, shared by everything that needs it. */
  product: (kind: "panel" | "inverter", id: string) => ["catalogue", kind, id] as const,
};
