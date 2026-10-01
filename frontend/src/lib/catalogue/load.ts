import "server-only";

import { serverApi } from "@/lib/api/server";
import type { components } from "@/lib/api/schema";

import { type CatalogueKind, offsetFor, PAGE_SIZE } from "./params";

export type ProductListItem = components["schemas"]["ProductListItem"];

export type CatalogueResult =
  | { ok: true; items: ProductListItem[]; total: number }
  | { ok: false };

type InverterCategory = NonNullable<
  components["schemas"]["InverterSpecifications"]["category"]
>;

/**
 * One page of the catalogue for validated filters. A backend problem is reported as `ok: false`
 * so the page can show a retry instead of failing; it never reaches the visitor as an exception.
 */
export async function loadCatalogue(
  kind: CatalogueKind,
  apiQuery: Record<string, string>,
  page: number,
): Promise<CatalogueResult> {
  const paging = { limit: PAGE_SIZE, offset: offsetFor(page) };
  try {
    const api = await serverApi();
    const { data } =
      kind === "panel"
        ? await api.GET("/catalogue/panels", {
            params: {
              query: {
                ...paging,
                search: apiQuery.search,
                min_wattage_w: apiQuery.min_wattage_w,
                max_wattage_w: apiQuery.max_wattage_w,
                min_efficiency_percent: apiQuery.min_efficiency_percent,
              },
            },
          })
        : await api.GET("/catalogue/inverters", {
            params: {
              query: {
                ...paging,
                search: apiQuery.search,
                // Already checked against the allowed values when the address was parsed.
                category: apiQuery.category as InverterCategory | undefined,
                min_capacity_kw: apiQuery.min_capacity_kw,
                max_capacity_kw: apiQuery.max_capacity_kw,
              },
            },
          });
    return data ? { ok: true, items: data.items, total: data.total } : { ok: false };
  } catch {
    return { ok: false };
  }
}
