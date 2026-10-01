import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProductListItem } from "@/lib/catalogue/load";
import { formatDecimal } from "@/lib/catalogue/params";
import { detailHref } from "@/lib/catalogue/links";
import { productName } from "@/lib/landing/format";
import { format, messages } from "@/messages";

const text = messages.catalogue.card;

function unit(template: string, value: string | null | undefined): string {
  const shown = formatDecimal(value);
  return shown === null ? text.unspecified : format(template, { value: shown });
}

/**
 * A catalogue entry with the specifications that can be filtered on. A value the catalogue does
 * not know is labelled "Not specified"; it is never shown as zero.
 */
export function ProductCard({
  product,
  listHref,
}: {
  product: ProductListItem;
  /** The list view this card is on, so the product page can lead back to it. */
  listHref: string;
}) {
  const rows =
    product.kind === "panel"
      ? [
          [text.power, unit(text.units.w, product.wattage_w)],
          [text.efficiency, unit(text.units.percent, product.efficiency_percent)],
        ]
      : [
          [
            text.type,
            product.category
              ? messages.catalogue.filters.typeOptions[product.category]
              : text.unspecified,
          ],
          [text.capacity, unit(text.units.kw, product.capacity_kw)],
        ];
  return (
    <Card className="relative h-full transition-colors hover:bg-muted/40">
      <CardHeader>
        <CardDescription>{messages.landing.products.kind[product.kind]}</CardDescription>
        <CardTitle>
          <h3>
            <Link
              href={detailHref(product.kind, product.id, listHref)}
              className="underline-offset-2 outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
            >
              {productName(product)}
            </Link>
          </h3>
        </CardTitle>
      </CardHeader>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-4 pb-4 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="px-4 pb-4 text-xs text-muted-foreground">
        {messages.landing.products.sampleNote}
      </p>
    </Card>
  );
}
