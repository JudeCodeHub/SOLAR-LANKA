import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { IconCircle } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/** The shared layout of the empty, error and not-found states: an illustration slot, a title, words and an action. */
export function StatePanel({
  icon: Icon,
  illustration,
  tone = "orange",
  heading: Heading = "p",
  title,
  description,
  action,
  className,
  ...rest
}: {
  icon: LucideIcon;
  /** Replaces the icon disc when a photo or drawing is available. */
  illustration?: ReactNode;
  tone?: "orange" | "danger";
  heading?: "p" | "h1" | "h2";
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
} & Omit<React.ComponentProps<"div">, "title">) {
  return (
    <div
      data-slot="state-panel"
      className={cn("flex flex-col items-center gap-3 rounded-panel border border-dashed border-line bg-surface p-8 text-center", className)}
      {...rest}
    >
      {illustration ?? <IconCircle icon={Icon} tone={tone} size="lg" />}
      <Heading className="type-subheading text-ink">{title}</Heading>
      <p className="type-body max-w-sm text-ink-2">{description}</p>
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-3">{action}</div> : null}
    </div>
  );
}
