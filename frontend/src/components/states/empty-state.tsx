import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { StatePanel } from "@/components/states/state-panel";
import { messages } from "@/messages";

/** The empty convention: say what is missing and what to do next. */
export function EmptyState({
  title = messages.states.emptyTitle,
  description = messages.states.emptyDescription,
  action,
  icon = Inbox,
  illustration,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  illustration?: ReactNode;
  className?: string;
}) {
  return <StatePanel icon={icon} illustration={illustration} title={title} description={description} action={action} className={className} />;
}
