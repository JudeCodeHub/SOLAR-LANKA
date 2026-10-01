import Link from "next/link";

import { buildCatalogueHref, type CatalogueKind, pageWindow } from "@/lib/catalogue/params";
import { cn } from "@/lib/utils";
import { format, messages } from "@/messages";

const text = messages.catalogue.pagination;
const itemClass =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Page links that keep every filter in the address. The current page is marked with
 * aria-current; unavailable Previous and Next stay in place as disabled text so the layout
 * does not shift.
 */
export function Pagination({
  basePath,
  kind,
  values,
  page,
  pageCount,
}: {
  basePath: string;
  kind: CatalogueKind;
  values: Record<string, string>;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) {
    return null;
  }
  const href = (target: number) => buildCatalogueHref(basePath, kind, { values, page: target });
  return (
    <nav aria-label={text.label}>
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          {page > 1 ? (
            <Link href={href(page - 1)} rel="prev" className={cn(itemClass, "hover:bg-muted")}>
              {text.previous}
            </Link>
          ) : (
            <span aria-disabled="true" className={cn(itemClass, "opacity-50")}>
              {text.previous}
            </span>
          )}
        </li>
        {pageWindow(page, pageCount).map((entry, index) =>
          entry === null ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted-foreground">
              {text.ellipsis}
            </li>
          ) : (
            <li key={entry}>
              {entry === page ? (
                <span aria-current="page" className={cn(itemClass, "bg-primary text-primary-foreground")}>
                  <span className="sr-only">{format(text.page, { page: entry })}</span>
                  <span aria-hidden="true">{entry}</span>
                </span>
              ) : (
                <Link
                  href={href(entry)}
                  aria-label={format(text.goTo, { page: entry })}
                  className={cn(itemClass, "hover:bg-muted")}
                >
                  {entry}
                </Link>
              )}
            </li>
          ),
        )}
        <li>
          {page < pageCount ? (
            <Link href={href(page + 1)} rel="next" className={cn(itemClass, "hover:bg-muted")}>
              {text.next}
            </Link>
          ) : (
            <span aria-disabled="true" className={cn(itemClass, "opacity-50")}>
              {text.next}
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
