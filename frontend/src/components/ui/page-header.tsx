import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** The top of a page: a small label, the one h1, a lead sentence and the page actions. */
export function PageHeader({
  eyebrow,
  title,
  titleId,
  level = "h1",
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  titleId?: string;
  /** Use h2 when the page already has its own h1, as in a sample or a nested layout. */
  level?: "h1" | "h2";
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  const Heading = level;
  return (
    <header data-slot="page-header" className={cn("flex flex-wrap items-end justify-between gap-x-8 gap-y-4", className)}>
      <div className="max-w-reading space-y-2">
        {eyebrow ? <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{eyebrow}</p> : null}
        <Heading id={titleId} className="type-display-m text-ink">{title}</Heading>
        {description ? <p className="type-body text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </header>
  );
}
