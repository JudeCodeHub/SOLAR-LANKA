import * as React from "react"
import { cn } from "cn"

/** The class for one choice in a segmented control, 44 px high; use it on a button (aria-pressed) or a link (aria-current). */
function segmentedItemClass(active: boolean, className?: string) {
  return cn(
    "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors",
    active ? "bg-orange text-on-orange" : "text-ink-2 hover:bg-paper-2 hover:text-ink",
    className
  )
}

/** A pill-shaped group of mutually exclusive choices. */
function Segmented({
  label,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "aria-label"> & { label: string }) {
  return (
    <div
      data-slot="segmented"
      role="group"
      aria-label={label}
      className={cn("inline-flex flex-wrap items-center gap-1 rounded-full border border-line bg-surface p-1", className)}
      {...props}
    />
  )
}

export { Segmented, segmentedItemClass }
