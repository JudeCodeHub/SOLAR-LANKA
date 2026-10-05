import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  /** Leave out on the current page, which is the last crumb. */
  href?: string;
}

/** Where you are: ancestors as links and the current page as plain text marked as current. */
export function Breadcrumbs({ label, items, className }: { label: string; items: Crumb[]; className?: string }) {
  return (
    <nav aria-label={label} data-slot="breadcrumbs" className={className}>
      <ol className="flex flex-wrap items-center gap-x-1 text-sm text-ink-2">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <Fragment key={`${item.label}-${index}`}>
              <li className="inline-flex min-h-11 items-center">
                {item.href && !last ? (
                  <Link href={item.href} className="rounded-full px-2 underline-offset-4 hover:text-ink hover:underline">
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className={cn("px-2", last && "font-medium text-ink")}>
                    {item.label}
                  </span>
                )}
              </li>
              {last ? null : (
                <li aria-hidden className="inline-flex items-center">
                  <ChevronRight className="size-4 text-ink-3" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
