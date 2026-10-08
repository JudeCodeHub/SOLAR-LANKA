import { BackLink } from "@/components/ui/back-link";
import { notFound } from "next/navigation";

import { Photo } from "@/components/ui/photo";
import { FavouriteButton } from "@/components/favourites/favourite-button";
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
    <BackLink href={backHref(kind, from)}>{messages.detail.back[kind]}</BackLink>
  );
  if (result.status === "error") {
    return (
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-10 sm:px-6">
        {back}
        <SectionUnavailable />
      </div>
    );
  }
  const { product, offers } = result;
  const name = productName(product);
  const images = productImages(product);
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-14 px-4 py-10 sm:px-6" data-product-detail={product.kind}>
      <header className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
        <div className="space-y-5">
          {back}
          <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{messages.landing.products.kind[product.kind]}</p>
          <h1 className="type-display-m text-ink">{name}</h1>
          <div className="flex flex-wrap items-center gap-4 rounded-card border border-line bg-surface p-3 sm:w-fit">
            <FavouriteButton id={product.id} name={name} />
            <ComparisonToggle kind={product.kind} id={product.id} name={name} />
          </div>
        </div>
        {images.length === 0 ? (
          <div className="overflow-hidden rounded-panel border border-line shadow-e2">
            <Photo
              name={product.kind === "panel" ? "panelPlaceholder" : "inverterPlaceholder"}
              sizes="(min-width: 1024px) 40vw, 100vw"
              priority
              className="aspect-[4/3] w-full object-cover dark:brightness-[0.72]"
            />
          </div>
        ) : null}
      </header>
      <ProductImages images={images} name={name} />
      <SpecificationTable groups={specificationGroups(product)} />
      <div className="grid gap-10 lg:grid-cols-2">
        <SourceSection source={sourceInfo(product)} />
        <DocumentsSection groups={documentGroups(product)} />
      </div>
      <OffersSection offers={offers} />
    </div>
  );
}
