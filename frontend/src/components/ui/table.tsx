import * as React from "react"
import { cn } from "cn"

/** A scrollable region that holds a wide table and can be focused so keyboard users can scroll it. */
function TableRegion({
  label,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "aria-label"> & { label: string }) {
  return (
    <div
      data-slot="table-region"
      role="region"
      aria-label={label}
      // A scrollable region must be focusable so keyboard users can scroll it (WCAG 2.1.1).
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      // Positioned, so screen-reader-only text inside the table is clipped with it instead of widening the page.
      className={cn("relative overflow-auto rounded-card border border-line bg-surface", className)}
      {...props}
    />
  )
}

/** A dense data table with a sticky header, soft stripes and a warm row highlight; cell markup stays with the caller. */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table
      data-slot="table"
      className={cn(
        "w-full border-collapse text-sm text-ink",
        "[&_th]:px-3 [&_th]:py-2.5 [&_td]:px-3 [&_td]:py-2.5",
        "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:border-b [&_thead_th]:border-line [&_thead_th]:bg-paper-2 [&_thead_th]:font-semibold [&_thead_th]:text-ink-2",
        "[&_tbody_tr]:border-b [&_tbody_tr]:border-line [&_tbody_tr:last-child]:border-0 [&_tbody_tr:nth-child(even)]:bg-paper-2/40 [&_tbody_tr:hover]:bg-orange-tint",
        className
      )}
      {...props}
    />
  )
}

export { Table, TableRegion }
