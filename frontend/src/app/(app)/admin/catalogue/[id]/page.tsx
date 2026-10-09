import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductEditor } from "@/components/admin/product-editor";
import { isProductId } from "@/lib/catalogue/links";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.adminProduct };

export default async function AdminProductPage(props: PageProps<"/admin/catalogue/[id]">) {
  const { id } = await props.params;
  // A malformed id can never name a product, so do not ask the backend.
  if (!isProductId(id)) notFound();
  return <ProductEditor id={id} />;
}
