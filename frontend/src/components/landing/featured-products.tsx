import Link from "next/link";

import { SectionUnavailable } from "@/components/landing/section-unavailable";
import { EmptyState } from "@/components/states/empty-state";
import { SampleBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Photo } from "@/components/ui/photo";
import { BASE_PATH, detailHref } from "@/lib/catalogue/links";
import type { ProductListItem } from "@/lib/catalogue/load";
import { formatDecimal } from "@/lib/catalogue/params";
import { productName } from "@/lib/landing/format";
import type { Section } from "@/lib/landing/load";
import { format, messages } from "@/messages";

const card = messages.catalogue.card;

function value(template: string, raw: string | null | undefined): string {
  const shown = formatDecimal(raw);
  return shown === null ? card.unspecified : format(template, { value: shown });
}

/** The two headline specifications of a product, in the figure face; a missing one says so rather than showing zero. */
function highlights(product: ProductListItem): [string, string][] {
  return product.kind === "panel"
    ? [
        [card.power, value(card.units.w, product.wattage_w)],
        [card.efficiency, value(card.units.percent, product.efficiency_percent)],
      ]
    : [
        [card.type, product.category ? messages.catalogue.filters.typeOptions[product.category] : card.unspecified],
        [card.capacity, value(card.units.kw, product.capacity_kw)],
      ];
}

/** A few catalogue entries on cards with a placeholder photo, their two headline figures and a link to the product page. */
export function FeaturedProducts({
  id,
  title,
  section,
  viewAll,
}: {
  id: string;
  title: string;
  section: Section<ProductListItem>;
  /** The full list, offered once the section has products to show. */
  viewAll?: { href: string; noun: string };
}) {
  const text = messages.landing.products;
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-5" data-showcase={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`${id}-title`} className="type-heading text-ink">
          {title}
        </h3>
        {section.ok && section.items.length > 0 ? (
          <p className="type-small text-ink-3">{format(text.showing, { shown: section.items.length, total: section.total })}</p>
        ) : null}
      </div>
      {!section.ok ? (
        <SectionUnavailable />
      ) : section.items.length === 0 ? (
        <EmptyState title={text.emptyTitle} description={text.emptyDescription} />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {section.items.map((product) => (
            <li key={product.id}>
              <Card className="group/product relative h-full gap-0 overflow-hidden p-0 transition-shadow hover:shadow-e3 motion-reduce:transition-none">
                <Photo
                  name={product.kind === "panel" ? "panelPlaceholder" : "inverterPlaceholder"}
                  sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
                  className="aspect-[4/3] w-full object-cover"
                />
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <p className="type-caption font-semibold tracking-widest text-ink-3 uppercase">{text.kind[product.kind]}</p>
                  <h4 className="type-subheading text-ink">
                    <Link
                      href={detailHref(product.kind, product.id, BASE_PATH[product.kind])}
                      className="underline-offset-4 outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
                    >
                      {productName(product)}
                    </Link>
                  </h4>
                  <dl className="description-list text-sm">
                    {highlights(product).map(([label, shown]) => (
                      <div key={label} className="contents">
                        <dt>{label}</dt>
                        <dd className="type-figure font-medium">{shown}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-auto pt-1">
                    <SampleBadge>{text.sampleNote}</SampleBadge>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {viewAll && section.ok && section.items.length > 0 ? (
        <Link href={viewAll.href} className="inline-flex min-h-11 items-center text-sm font-semibold text-orange-text underline underline-offset-4">
          {format(messages.catalogue.results.viewAll, { noun: viewAll.noun })}
        </Link>
      ) : null}
    </section>
  );
}
