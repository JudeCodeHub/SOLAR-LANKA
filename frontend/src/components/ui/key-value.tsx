import { Fragment } from "react";

import { cn } from "@/lib/utils";

/** Labelled facts as a description list; each value can carry its own figure styling. */
export function KeyValue({ items, className }: { items: { term: string; value: string }[]; className?: string }) {
  return (
    <dl data-slot="key-value" className={cn("description-list text-sm", className)}>
      {items.map((item) => (
        <Fragment key={item.term}>
          <dt>{item.term}</dt>
          <dd className="type-figure font-medium">{item.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
