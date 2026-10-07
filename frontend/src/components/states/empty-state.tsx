import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyArt, type EmptyArtKind } from "@/components/states/empty-art";
import { StatePanel } from "@/components/states/state-panel";
import { messages } from "@/messages";

/** The empty convention: a line drawing, what is missing and what to do next. */
export function EmptyState({
  title = messages.states.emptyTitle,
  description = messages.states.emptyDescription,
  action,
  icon = Inbox,
  illustration,
  art = "generic",
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  illustration?: ReactNode;
  /** Which line drawing to show when there is no photo; every empty state has one. */
  art?: EmptyArtKind;
  className?: string;
}) {
  return <StatePanel icon={icon} illustration={illustration ?? <EmptyArt kind={art} />} title={title} description={description} action={action} className={className} />;
}
