import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { UnspecifiedValue } from "@/components/catalogue/detail/unspecified-value";
import { ExternalLink } from "@/components/catalogue/detail/external-link";
import { SectionUnavailable } from "@/components/landing/section-unavailable";
import { EmptyState } from "@/components/states/empty-state";
import type { ProductDetail } from "@/lib/catalogue/detail";
import { BASE_PATH, detailHref } from "@/lib/catalogue/links";
import { loadProductDetail } from "@/lib/catalogue/load-detail";
import type { CatalogueKind } from "@/lib/catalogue/params";
import { canCompare, compareHref, parseCompareIds } from "@/lib/comparison/selection";
import { buildComparison, type CompareCell } from "@/lib/comparison/table";
import { productName } from "@/lib/landing/format";
import { format, messages, plural } from "@/messages";

const text = messages.compare;

function Cell({ cell }: { cell: CompareCell }) {
  switch (cell.kind) {
    case "value":
      return <>{cell.text}</>;
    case "link":
      return <ExternalLink href={cell.href}>{cell.text}</ExternalLink>;
    case "unspecified":
      return <UnspecifiedValue />;
    case "unavailable":
      return <span className="text-muted-foreground italic">{text.unavailable}</span>;
  }
}

/** A side-by-side comparison of up to three products. */
export async function ComparePage({
  kind,
  searchParams,
}: {
  kind: CatalogueKind;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { ids, ignored } = parseCompareIds(searchParams.ids);
  const copy = kind === "panel" ? text.panels : text.inverters;
  const results = await Promise.all(ids.map((id) => loadProductDetail(kind, id)));
  const backLink = (
    <Link href={BASE_PATH[kind]} className="inline-flex items-center gap-1 text-sm underline underline-offset-2">
      <ArrowLeft aria-hidden className="size-4" />
      {messages.detail.back[kind]}
    </Link>
  );
  const header = (
    <header className="space-y-2">
      {backLink}
      <h1 className="font-heading text-3xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="max-w-3xl text-muted-foreground">{copy.intro}</p>
      {ignored > 0 ? (
        <p role="status" className="text-sm text-destructive">
          {format(plural(text.ignored, ignored), { count: ignored })}
        </p>
      ) : null}
    </header>
  );
  const frame = (children: React.ReactNode) => (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
      {header}
      {children}
    </div>
  );

  if (!canCompare(ids)) {
    return frame(<EmptyState title={text.needTwoTitle} description={text.needTwoHelp} />);
  }
  if (results.some((result) => result.status === "error")) {
    return frame(<SectionUnavailable />);
  }

  const products: (ProductDetail | null)[] = results.map((result) =>
    result.status === "ok" ? result.product : null,
  );
  const sections = buildComparison(products);
  const columns = ids.map((id, index) => ({ id, product: products[index] ?? null }));

  return frame(
    <>
      <div
        role="region"
        aria-label={text.tableLabel}
        // A scrollable region must be focusable so keyboard users can scroll it (WCAG 2.1.1).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className="overflow-x-auto rounded-lg border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <caption className="sr-only">{text.caption}</caption>
          <thead>
            <tr className="border-b bg-muted/40 align-top">
              <th scope="col" className="w-48 p-3 text-left font-medium">
                {text.property}
              </th>
              {columns.map(({ id, product }) => {
                const name = product ? productName(product) : text.unavailable;
                return (
                  <th key={id} scope="col" className="p-3 text-left font-medium">
                    {product ? (
                      <Link href={detailHref(kind, id, BASE_PATH[kind])} className="underline underline-offset-2">
                        {name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground italic">{name}</span>
                    )}
                    <div className="mt-1 text-xs font-normal">
                      <Link
                        href={compareHref(kind, ids.filter((other) => other !== id))}
                        aria-label={format(text.remove, { name })}
                        className="text-muted-foreground underline underline-offset-2"
                      >
                        {text.removeShort}
                      </Link>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          {sections.map((section) => (
            <tbody key={section.id}>
              <tr className="bg-muted/30">
                <th scope="rowgroup" colSpan={columns.length + 1} className="p-3 text-left font-medium">
                  {section.title}
                </th>
              </tr>
              {section.rows.map((row) => (
                <tr key={row.key} className="border-t align-top">
                  <th scope="row" className="p-3 text-left font-normal text-muted-foreground">
                    {row.label}
                  </th>
                  {row.cells.map((cell, index) => (
                    <td key={columns[index]?.id ?? index} className="p-3">
                      <Cell cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="text-sm text-muted-foreground">{text.shareNote}</p>
      {columns.some((column) => column.product === null) ? (
        <p role="status" className="text-sm text-muted-foreground">
          {text.unavailableNote}
        </p>
      ) : null}
    </>,
  );
}
