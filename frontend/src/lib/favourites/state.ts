/**
 * Rules for the favourites hearts, as pure functions with no React imports.
 *
 * The server decides what is a favourite. These helpers only describe the immediate, expected
 * outcome of a click so the heart can respond at once (an optimistic update); if the server
 * disagrees the change is rolled back and the server's list wins.
 */

/** Newest first, no duplicates: what the list looks like after saving or removing one product. */
export function applyFavourite(ids: readonly string[], id: string, favourite: boolean): string[] {
  const without = ids.filter((existing) => existing !== id);
  return favourite ? [id, ...without] : without;
}

/** Whether saving this product would go past the limit (saving one already saved never does). */
export function wouldExceedLimit(ids: readonly string[], id: string, max: number): boolean {
  return !ids.includes(id) && ids.length >= max;
}
