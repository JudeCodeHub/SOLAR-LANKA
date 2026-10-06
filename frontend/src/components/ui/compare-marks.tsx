import { ArrowLeftRight, CircleHelp } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { messages } from "@/messages";

/** How a value nobody has given is shown everywhere: a dashed pill with a question mark and the words, never a blank or a zero. */
export function NotSpecified({ className }: { className?: string }) {
  return (
    <span
      data-unspecified
      data-cell="unspecified"
      className={cn("inline-flex items-center gap-1 rounded-full border border-dashed border-field-border bg-paper-2 px-2.5 py-0.5 text-xs font-medium text-ink-2", className)}
    >
      <CircleHelp aria-hidden className="size-3" />
      {messages.catalogue.card.unspecified}
    </span>
  );
}

/** The words under a row's name when its values differ between the things compared. */
export function DifferenceFlag({ children }: { children: ReactNode }) {
  return (
    <span data-flag="differs" className="mt-1 flex items-center gap-1 text-xs font-semibold text-ink">
      <ArrowLeftRight aria-hidden className="size-3 text-orange-text" />
      {children}
    </span>
  );
}

/** The words under a row's name when some or all of its values are not specified. */
export function UnspecifiedFlag({ children }: { children: ReactNode }) {
  return (
    <span data-flag="unspecified" className="mt-1 flex items-center gap-1 text-xs text-ink-2">
      <CircleHelp aria-hidden className="size-3" />
      {children}
    </span>
  );
}

/** The orange edge on the left of a row's name when its values differ. */
export const DIFFERS_EDGE = "border-l-4 border-l-orange";
