import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

import { messages } from "@/messages";
import { cn } from "@/lib/utils";

/** The empty convention: say what is missing and. */
export function EmptyState({
  title = messages.states.emptyTitle,
  description = messages.states.emptyDescription,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center",
        className,
      )}
    >
      <Inbox aria-hidden className="size-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
