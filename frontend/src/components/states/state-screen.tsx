import type { ReactNode } from "react";

import { Photo } from "@/components/ui/photo";
import { cn } from "@/lib/utils";

/** A full-page state (not found, error): words and actions beside a photo that stacks under them on a phone. */
export function StateScreen({
  eyebrow,
  title,
  description,
  actions,
  tone = "orange",
  heading: Heading = "h1",
  alert = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions: ReactNode;
  tone?: "orange" | "danger";
  heading?: "h1" | "h2";
  /** Announce the words to screen readers as soon as the page shows, for an error. */
  alert?: boolean;
}) {
  return (
    <div className="mx-auto grid w-full max-w-wide flex-1 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24" data-state-screen>
      <div className="space-y-5" {...(alert ? { role: "alert" } : {})}>
        <p className={cn("type-caption font-semibold tracking-widest uppercase", tone === "danger" ? "text-danger" : "text-orange-text")}>{eyebrow}</p>
        <Heading className="type-display-m text-ink">{title}</Heading>
        <p className="type-body max-w-md text-ink-2">{description}</p>
        <div className="flex flex-wrap gap-3 pt-2">{actions}</div>
      </div>
      <div className="overflow-hidden rounded-panel border border-line shadow-e2">
        <Photo name="errorSky" sizes="(min-width: 1024px) 560px, 100vw" priority className="aspect-[4/3] w-full object-cover" />
      </div>
    </div>
  );
}
