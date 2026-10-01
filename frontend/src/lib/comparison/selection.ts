/** The rules of the comparison selection. */
import { isProductId } from "../catalogue/links.ts";
import type { CatalogueKind } from "../catalogue/params.ts";

export const MAX_COMPARE = 3;
export const MIN_COMPARE = 2;

export type Selection = Record<CatalogueKind, string[]>;

export const EMPTY_SELECTION: Selection = { panel: [], inverter: [] };

export type ToggleOutcome = "added" | "removed" | "full";

/** Add the id if there is room, remove it if it is already selected. */
export function toggleSelection(
  ids: readonly string[],
  id: string,
  max: number = MAX_COMPARE,
): { ids: string[]; outcome: ToggleOutcome } {
  if (ids.includes(id)) {
    return { ids: ids.filter((existing) => existing !== id), outcome: "removed" };
  }
  if (ids.length >= max) {
    return { ids: [...ids], outcome: "full" };
  }
  return { ids: [...ids, id], outcome: "added" };
}

/** Turn whatever was read back from browser storage into a valid selection. */
export function sanitizeSelection(raw: unknown): Selection {
  const result: Selection = { panel: [], inverter: [] };
  if (typeof raw !== "object" || raw === null) return result;
  for (const kind of ["panel", "inverter"] as const) {
    const value = (raw as Record<string, unknown>)[kind];
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (
        typeof entry === "string" &&
        isProductId(entry) &&
        !result[kind].includes(entry) &&
        result[kind].length < MAX_COMPARE
      ) {
        result[kind].push(entry);
      }
    }
  }
  return result;
}

export function canCompare(ids: readonly string[]): boolean {
  return ids.length >= MIN_COMPARE && ids.length <= MAX_COMPARE;
}

const COMPARE_PATH: Record<CatalogueKind, string> = {
  panel: "/panels/compare",
  inverter: "/inverters/compare",
};

/** The shareable address of a comparison: the ids are in the link, nothing is stored server-side. */
export function compareHref(kind: CatalogueKind, ids: readonly string[]): string {
  return ids.length === 0 ? COMPARE_PATH[kind] : `${COMPARE_PATH[kind]}?ids=${ids.join(",")}`;
}

export interface ParsedCompareIds {
  ids: string[];
  /** How many entries were ignored (malformed, repeated, or beyond the limit). */
  ignored: number;
}

/** Read `?ids=a,b,c` (or repeated `ids`) from a comparison address, keeping valid distinct ids. */
export function parseCompareIds(raw: string | string[] | undefined): ParsedCompareIds {
  const parts = (Array.isArray(raw) ? raw : [raw])
    .flatMap((value) => (value ?? "").split(","))
    .map((part) => part.trim())
    .filter((part) => part !== "");
  const ids: string[] = [];
  let ignored = 0;
  for (const part of parts) {
    const id = part.toLowerCase();
    if (isProductId(id) && !ids.includes(id) && ids.length < MAX_COMPARE) {
      ids.push(id);
    } else {
      ignored += 1;
    }
  }
  return { ids, ignored };
}
