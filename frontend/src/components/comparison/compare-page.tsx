import { BackLink } from "@/components/ui/back-link";
import { Table, TableRegion } from "@/components/ui/table";
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
import { buildComparison, type CompareCell, rowRelation } from "@/lib/comparison/table";
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
    <BackLink href={BASE_PATH[kind]}>{messages.detail.back[kind]}</BackLink>
  );
  const header = (
    <header className="space-y-3">
      {backLink}
      <h1 className="type-display-m text-ink">{copy.title}</h1>
      <p className="type-body max-w-3xl text-ink-2">{copy.intro}</p>
      {ignored > 0 ? (
        <p role="status" className="text-sm font-medium text-danger">
          {format(plural(text.ignored, ignored), { count: ignored })}
        </p>
      ) : null}
    </header>
  );
  const frame = (children: React.ReactNode) => (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-10 sm:px-6" data-compare-page>
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
      <TableRegion label={text.tableLabel} className="max-h-[75vh]" data-compare-region>
        <Table className="min-w-[40rem]" data-compare-table>
          <caption className="sr-only">{text.caption}</caption>
          <thead>
            <tr className="align-top">
              <th scope="col" className="sticky left-0 z-20 w-28 text-left sm:w-48">
                {text.property}
              </th>
              {columns.map(({ id, product }) => {
                const name = product ? productName(product) : text.unavailable;
                return (
                  <th key={id} scope="col" className="text-left">
                    {product ? (
                      <Link href={detailHref(kind, id, BASE_PATH[kind])} className="type-subheading text-ink underline-offset-4 hover:underline">
                        {name}
                      </Link>
                    ) : (
                      <span className="text-ink-2 italic">{name}</span>
                    )}
                    <div className="text-xs font-normal">
                      <Link
                        href={compareHref(kind, ids.filter((other) => other !== id))}
                        aria-label={format(text.remove, { name })}
                        className="inline-flex min-h-11 items-center text-ink-2 underline underline-offset-4 hover:text-ink"
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
              <tr className="bg-paper-2">
                <th scope="rowgroup" colSpan={columns.length + 1} className="type-caption text-left font-semibold tracking-widest text-ink-3 uppercase">
                  {section.title}
                </th>
              </tr>
              {section.rows.map((row) => {
                const relation = rowRelation(row.cells);
                return (
                  <tr key={row.key} className="align-top" data-row={row.key} data-relation={relation}>
                    <th scope="row" className={`sticky left-0 z-10 bg-surface text-left font-normal text-ink-2 ${relation === "differs" ? "border-l-4 border-l-orange" : ""}`}>
                      <span className="block">{row.label}</span>
                      {relation === "differs" ? (
                        <span className="mt-1 block text-xs font-medium text-ink" data-flag="differs">{text.differs}</span>
                      ) : null}
                      {relation === "unspecified" || relation === "none" ? (
                        <span className="mt-1 block text-xs text-ink-2" data-flag="unspecified">{relation === "none" ? text.noneSpecified : text.someUnspecified}</span>
                      ) : null}
                    </th>
                    {row.cells.map((cell, index) => (
                      <td key={columns[index]?.id ?? index} className={relation === "differs" ? "type-figure font-semibold text-ink" : "type-figure"}>
                        <Cell cell={cell} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </Table>
      </TableRegion>
      <p className="type-small text-ink-2">{text.shareNote}</p>
      {columns.some((column) => column.product === null) ? (
        <p role="status" className="type-small text-ink-2">
          {text.unavailableNote}
        </p>
      ) : null}
    </>,
  );
}
