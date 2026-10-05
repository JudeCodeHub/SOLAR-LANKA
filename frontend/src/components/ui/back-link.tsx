import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** The one way back from a detail page: an arrow that nudges left on hover, 44 px high, with the destination in words. */
export function BackLink({ className, children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      data-slot="back-link"
      className={cn("group/back -ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink motion-reduce:transition-none", className)}
      {...props}
    >
      <ArrowLeft aria-hidden className="size-4 transition-transform group-hover/back:-translate-x-0.5 motion-reduce:transition-none" />
      {children}
    </Link>
  );
}
