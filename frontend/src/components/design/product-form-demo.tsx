"use client";

import { ProductForm } from "@/components/admin/product-editor";

const PRODUCT = {
  kind: "panel",
  brand: "Trina",
  model: "TSM-545",
  specifications: { wattage_w: "545", efficiency_percent: "21.1", cell_type: "Monocrystalline", warranty_details: null },
} as never;

/** The product edit form with a sample panel, for the design page; the checks run before anything is sent, so nothing here reaches the API. */
export function ProductFormDemo() {
  return (
    <div className="max-w-3xl" data-product-form-sample>
      <ProductForm id="p1" product={PRODUCT} />
    </div>
  );
}
