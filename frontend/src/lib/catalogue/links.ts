/** Addresses between the catalogue list and a product's page. */
import type { CatalogueKind } from "./params.ts";

export const BASE_PATH: Record<CatalogueKind, string> = {
  panel: "/panels",
  inverter: "/inverters",
};

/** The product's page, remembering the list view it was opened from. */
export function detailHref(kind: CatalogueKind, id: string, listHref: string): string {
  const base = BASE_PATH[kind];
  const path = `${base}/${encodeURIComponent(id)}`;
  return listHref === base ? path : `${path}?from=${encodeURIComponent(listHref)}`;
}

/** Where "Back to results" goes: the remembered list view if it is valid, else the plain list. */
export function backHref(kind: CatalogueKind, from: string | string[] | undefined): string {
  const base = BASE_PATH[kind];
  const value = Array.isArray(from) ? from[0] : from;
  if (!value || /[\u0000-\u001f\u007f\\]/.test(value)) return base;
  // Same list only: exactly the base path, optionally followed by a query string.
  if (value === base || (value.startsWith(`${base}?`) && !value.includes("#"))) return value;
  return base;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Whether the text can be a product id. Anything else is a missing page, not a backend call. */
export function isProductId(value: string): boolean {
  return UUID.test(value);
}
