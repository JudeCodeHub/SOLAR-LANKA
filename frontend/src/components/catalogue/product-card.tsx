import Link from "next/link";

import { ComparisonToggle } from "@/components/comparison/comparison-toggle";
import { FavouriteButton } from "@/components/favourites/favourite-button";
import { SampleBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Photo } from "@/components/ui/photo";
import { detailHref } from "@/lib/catalogue/links";
import type { ProductListItem } from "@/lib/catalogue/load";
import { formatDecimal } from "@/lib/catalogue/params";
import { productName } from "@/lib/landing/format";
import { format, messages } from "@/messages";

const text = messages.catalogue.card;

function unit(template: string, value: string | null | undefined): string {
  const shown = formatDecimal(value);
  return shown === null ? text.unspecified : format(template, { value: shown });
}

/** The two headline specifications of a product; a missing one says "Not specified" rather than showing zero. */
function highlights(product: ProductListItem): [string, string][] {
  return product.kind === "panel"
    ? [
        [text.power, unit(text.units.w, product.wattage_w)],
        [text.efficiency, unit(text.units.percent, product.efficiency_percent)],
      ]
    : [
        [text.type, product.category ? messages.catalogue.filters.typeOptions[product.category] : text.unspecified],
        [text.capacity, unit(text.units.kw, product.capacity_kw)],
      ];
}

/** A catalogue entry: a photo, the kind, the brand and model as one link, two headline figures in the figure face, a sample label and, on the lists, the favourite and compare controls. */
export function ProductCard({
  product,
  listHref,
  headingLevel: Heading = "h3",
  actions = true,
}: {
  product: ProductListItem;
  /** The list view this card is on, so the product page can lead back to it. */
  listHref: string;
  /** Use h4 when the card sits under a section's own h3, as on the landing page. */
  headingLevel?: "h3" | "h4";
  /** The favourite and compare controls; the landing page leaves them out. */
  actions?: boolean;
}) {
  const name = productName(product);
  return (
    <Card className="group/product relative h-full gap-0 overflow-hidden p-0 transition-shadow hover:shadow-e3 motion-reduce:transition-none" data-product={product.id}>
      <div className="relative">
        <Photo
          name={product.kind === "panel" ? "panelPlaceholder" : "inverterPlaceholder"}
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
          className="aspect-[4/3] w-full object-cover dark:brightness-[0.72]"
        />
        {actions ? (
          <div className="absolute top-3 right-3 z-10 rounded-full bg-surface/90 backdrop-blur-sm">
            <FavouriteButton id={product.id} name={name} />
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="type-caption font-semibold tracking-widest text-ink-3 uppercase">{messages.landing.products.kind[product.kind]}</p>
        <Heading className="type-subheading text-ink">
          <Link
            href={detailHref(product.kind, product.id, listHref)}
            className="underline-offset-4 outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
          >
            {name}
          </Link>
        </Heading>
        <dl className="description-list text-sm">
          {highlights(product).map(([label, value]) => (
            <div key={label} className="contents">
              <dt>{label}</dt>
              <dd className="type-figure font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
          <SampleBadge>{messages.landing.products.sampleNote}</SampleBadge>
        </div>
        {actions ? (
          <div className="relative z-10 border-t border-line pt-3">
            <ComparisonToggle kind={product.kind} id={product.id} name={name} />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
