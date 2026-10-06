import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** A section that opens and closes, using the browser's own details element so it works with the keyboard and screen readers and without script. */
export function AccordionItem({
  title,
  hint,
  open = false,
  children,
  className,
  ...rest
}: {
  title: string;
  /** A short line under the title that says what is inside. */
  hint?: string;
  open?: boolean;
  children: ReactNode;
  className?: string;
} & Omit<React.ComponentProps<"details">, "title" | "children" | "className" | "open">) {
  return (
    <details data-slot="accordion-item" open={open} className={cn("group rounded-card border border-line bg-surface shadow-e1", className)} {...rest}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-card px-5 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="space-y-0.5">
          <span className="type-subheading block text-ink">{title}</span>
          {hint ? <span className="type-small block text-ink-2">{hint}</span> : null}
        </span>
        <ChevronDown aria-hidden className="size-5 shrink-0 text-ink-3 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="space-y-3 border-t border-line px-5 py-4 text-sm">{children}</div>
    </details>
  );
}
