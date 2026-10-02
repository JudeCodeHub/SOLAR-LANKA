import Link from "next/link";

import { EmptyState } from "@/components/states/empty-state";
import { SectionUnavailable } from "@/components/landing/section-unavailable";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { components } from "@/lib/api/schema";
import { BASE_PATH, detailHref } from "@/lib/catalogue/links";
import { productName } from "@/lib/landing/format";
import type { Section } from "@/lib/landing/load";
import { format, messages } from "@/messages";

type Product = components["schemas"]["ProductSummary"];

/** A few catalogue entries. Detail pages and specifications arrive with the product screens. */
export function FeaturedProducts({
  id,
  title,
  section,
  viewAll,
}: {
  id: string;
  title: string;
  section: Section<Product>;
  /** The full list, offered once the section has products to show. */
  viewAll?: { href: string; noun: string };
}) {
  const text = messages.landing.products;
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${id}-title`} className="font-heading text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        {section.ok && section.items.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {format(text.showing, { shown: section.items.length, total: section.total })}
          </p>
        ) : null}
      </div>
      {!section.ok ? (
        <SectionUnavailable />
      ) : section.items.length === 0 ? (
        <EmptyState title={text.emptyTitle} description={text.emptyDescription} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {section.items.map((product) => (
            <li key={product.id}>
              <Card className="relative h-full transition-colors hover:bg-muted/40">
                <CardHeader>
                  <CardDescription>{text.kind[product.kind]}</CardDescription>
                  <CardTitle>
                    <Link
                      href={detailHref(product.kind, product.id, BASE_PATH[product.kind])}
                      className="underline-offset-2 outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
                    >
                      {productName(product)}
                    </Link>
                  </CardTitle>
                  <CardDescription>{text.sampleNote}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {viewAll && section.ok && section.items.length > 0 ? (
        <Link href={viewAll.href} className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-2">
          {format(messages.catalogue.results.viewAll, { noun: viewAll.noun })}
        </Link>
      ) : null}
    </section>
  );
}
