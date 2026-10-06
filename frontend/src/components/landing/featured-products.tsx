import Link from "next/link";

import { SectionUnavailable } from "@/components/landing/section-unavailable";
import { EmptyState } from "@/components/states/empty-state";
import { ProductCard } from "@/components/catalogue/product-card";
import { BASE_PATH } from "@/lib/catalogue/links";
import type { ProductListItem } from "@/lib/catalogue/load";
import type { Section } from "@/lib/landing/load";
import { format, messages } from "@/messages";

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
              <ProductCard product={product} listHref={BASE_PATH[product.kind]} headingLevel="h4" actions={false} />
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
