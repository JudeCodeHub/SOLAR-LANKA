import "server-only";

import { cache } from "react";

import { serverApi } from "@/lib/api/server";

import type { ProductDetail, PublicProductOffer } from "./detail";
import type { CatalogueKind } from "./params";

export type OffersResult = { ok: true; items: PublicProductOffer[]; total: number } | { ok: false };

export type DetailResult =
  | { status: "ok"; product: ProductDetail; offers: OffersResult }
  | { status: "not-found" }
  | { status: "error" };

/** A product and its public offers. */
export const loadProductDetail = cache(
  async (kind: CatalogueKind, id: string): Promise<DetailResult> => {
    try {
      const api = await serverApi();
      const params = { params: { path: { product_id: id }, query: { limit: 50 } } };
      const [product, offers] =
        kind === "panel"
          ? await Promise.all([
              api.GET("/catalogue/panels/{product_id}", { params: { path: { product_id: id } } }),
              api.GET("/catalogue/panels/{product_id}/offers", params),
            ])
          : await Promise.all([
              api.GET("/catalogue/inverters/{product_id}", { params: { path: { product_id: id } } }),
              api.GET("/catalogue/inverters/{product_id}/offers", params),
            ]);
      if (product.response.status === 404 || product.response.status === 422) {
        return { status: "not-found" };
      }
      if (!product.data) {
        return { status: "error" };
      }
      return {
        status: "ok",
        product: product.data,
        offers: offers.data
          ? { ok: true, items: offers.data.items, total: offers.data.total }
          : { ok: false },
      };
    } catch {
      return { status: "error" };
    }
  },
);
