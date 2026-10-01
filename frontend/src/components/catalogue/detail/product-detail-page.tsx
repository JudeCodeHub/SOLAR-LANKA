import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ComparisonToggle } from "@/components/comparison/comparison-toggle";
import { DocumentsSection } from "@/components/catalogue/detail/documents-section";
import { OffersSection } from "@/components/catalogue/detail/offers-section";
import { ProductImages } from "@/components/catalogue/detail/product-images";
import { SourceSection } from "@/components/catalogue/detail/source-section";
import { SpecificationTable } from "@/components/catalogue/detail/specification-table";
import { SectionUnavailable } from "@/components/landing/section-unavailable";
import { documentGroups, productImages, sourceInfo, specificationGroups } from "@/lib/catalogue/detail";
import { backHref, isProductId } from "@/lib/catalogue/links";
import { loadProductDetail } from "@/lib/catalogue/load-detail";
import type { CatalogueKind } from "@/lib/catalogue/params";
import { productName } from "@/lib/landing/format";
import { messages } from "@/messages";

/** One product: specifications with units, where they come from, documents and sample offers. */
export async function ProductDetailPage({
  kind,
  id,
  from,
}: {
  kind: CatalogueKind;
  id: string;
  from?: string | string[];
}) {
  if (!isProductId(id)) {
    notFound();
  }
  const result = await loadProductDetail(kind, id);
  if (result.status === "not-found") {
    notFound();
  }
  const back = (
    <Link
      href={backHref(kind, from)}
      className="inline-flex items-center gap-1 text-sm underline underline-offset-2"
    >
      <ArrowLeft aria-hidden className="size-4" />
      {messages.detail.back[kind]}
    </Link>
  );
  if (result.status === "error") {
    return (
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
        {back}
        <SectionUnavailable />
      </div>
    );
  }
  const { product, offers } = result;
  const name = productName(product);
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-4 py-8">
      <header className="space-y-2">
        {back}
        <p className="text-sm text-muted-foreground">{messages.landing.products.kind[product.kind]}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{name}</h1>
        <p className="text-sm text-muted-foreground">{messages.detail.sampleEntry}</p>
        <ComparisonToggle kind={product.kind} id={product.id} name={name} />
      </header>
      <ProductImages images={productImages(product)} name={name} />
      <SpecificationTable groups={specificationGroups(product)} />
      <SourceSection source={sourceInfo(product)} />
      <DocumentsSection groups={documentGroups(product)} />
      <OffersSection offers={offers} />
    </div>
  );
}
