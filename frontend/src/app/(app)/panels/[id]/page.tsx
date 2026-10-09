import type { Metadata } from "next";

import { ProductDetailPage } from "@/components/catalogue/detail/product-detail-page";
import { isProductId } from "@/lib/catalogue/links";
import { loadProductDetail } from "@/lib/catalogue/load-detail";
import { productName } from "@/lib/landing/format";
import { format, messages } from "@/messages";

export async function generateMetadata(props: PageProps<"/panels/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (!isProductId(id)) {
    return { title: messages.titles.notFound };
  }
  const result = await loadProductDetail("panel", id);
  return result.status === "ok"
    ? { title: format(messages.titles.product, { name: productName(result.product) }) }
    : { title: messages.titles.notFound };
}

export default async function PanelsDetailPage(props: PageProps<"/panels/[id]">) {
  const [{ id }, search] = await Promise.all([props.params, props.searchParams]);
  return <ProductDetailPage kind="panel" id={id} from={search.from} />;
}
