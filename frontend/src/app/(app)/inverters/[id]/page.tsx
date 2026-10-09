import type { Metadata } from "next";

import { ProductDetailPage } from "@/components/catalogue/detail/product-detail-page";
import { isProductId } from "@/lib/catalogue/links";
import { loadProductDetail } from "@/lib/catalogue/load-detail";
import { productName } from "@/lib/landing/format";
import { format, messages } from "@/messages";

export async function generateMetadata(props: PageProps<"/inverters/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (!isProductId(id)) {
    return { title: messages.titles.notFound };
  }
  const result = await loadProductDetail("inverter", id);
  return result.status === "ok"
    ? { title: format(messages.titles.product, { name: productName(result.product) }) }
    : { title: messages.titles.notFound };
}

export default async function InvertersDetailPage(props: PageProps<"/inverters/[id]">) {
  const [{ id }, search] = await Promise.all([props.params, props.searchParams]);
  return <ProductDetailPage kind="inverter" id={id} from={search.from} />;
}
