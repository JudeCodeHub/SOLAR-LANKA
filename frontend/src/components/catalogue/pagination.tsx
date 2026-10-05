import Link from "next/link";

import { pageWindow } from "@/lib/catalogue/params";
import { cn } from "@/lib/utils";
import { format, messages } from "@/messages";

const text = messages.catalogue.pagination;
const itemClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-field border border-line bg-surface px-3 text-sm font-medium text-ink";

/** Page links that keep every filter in the address. */
export function Pagination({
  hrefFor,
  page,
  pageCount,
}: {
  /** The address of a given page, keeping whatever else the list's address carries. */
  hrefFor: (page: number) => string;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) {
    return null;
  }
  const href = hrefFor;
  return (
    <nav aria-label={text.label}>
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          {page > 1 ? (
            <Link href={href(page - 1)} rel="prev" className={cn(itemClass, "hover:bg-paper-2")}>
              {text.previous}
            </Link>
          ) : (
            <span aria-disabled="true" className={cn(itemClass, "text-disabled-text")}>
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
                <span aria-current="page" className={cn(itemClass, "border-orange bg-orange text-on-orange")}>
                  <span className="sr-only">{format(text.page, { page: entry })}</span>
                  <span aria-hidden="true">{entry}</span>
                </span>
              ) : (
                <Link
                  href={href(entry)}
                  aria-label={format(text.goTo, { page: entry })}
                  className={cn(itemClass, "hover:bg-paper-2")}
                >
                  {entry}
                </Link>
              )}
            </li>
          ),
        )}
        <li>
          {page < pageCount ? (
            <Link href={href(page + 1)} rel="next" className={cn(itemClass, "hover:bg-paper-2")}>
              {text.next}
            </Link>
          ) : (
            <span aria-disabled="true" className={cn(itemClass, "text-disabled-text")}>
              {text.next}
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
