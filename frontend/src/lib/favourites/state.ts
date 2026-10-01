/** Rules for the favourites hearts, as pure functions with no React imports. */

/** Newest first, no duplicates: what the list looks like after saving or removing one product. */
export function applyFavourite(ids: readonly string[], id: string, favourite: boolean): string[] {
  const without = ids.filter((existing) => existing !== id);
  return favourite ? [id, ...without] : without;
}

/** Whether saving this product would go past the limit (saving one already saved never does). */
export function wouldExceedLimit(ids: readonly string[], id: string, max: number): boolean {
  return !ids.includes(id) && ids.length >= max;
}
