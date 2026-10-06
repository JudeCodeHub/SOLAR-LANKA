import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatLongDate } from "@/lib/catalogue/detail";
import { progressText } from "@/lib/installations/progress";
import { cn } from "@/lib/utils";
import { format, messages } from "@/messages";

const text = messages.tracking.list;

/** One segment for each step: filled when done, outlined for the step that is next, empty after that. Decoration only, the words say the same. */
function StepTrack({ completed, total }: { completed: number; total: number }) {
  return (
    <div aria-hidden className="flex gap-1" data-track>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          data-segment={index < completed ? "done" : index === completed ? "next" : "later"}
          className={cn("h-2 flex-1 rounded-full", index < completed ? "bg-orange-text" : index === completed ? "border-2 border-orange-text bg-orange-tint" : "bg-line")}
        />
      ))}
    </div>
  );
}

/** One accepted installation: the day it began, how many steps are complete, and a track of all the steps; the whole card opens it. */
export function InstallationCard({ item }: { item: { id: string; created_at: string; completed_milestones: number; total_milestones: number } }) {
  const words = progressText(item.completed_milestones, item.total_milestones);
  const done = item.total_milestones > 0 && item.completed_milestones >= item.total_milestones;
  return (
    <article data-installation={done ? "done" : "going"} className="relative flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-5 shadow-e1 transition-shadow hover:shadow-e2 motion-reduce:transition-none">
      <Badge variant={done ? "success" : "info"} className="w-fit">
        {words}
      </Badge>
      <h2 className="type-subheading text-ink">
        <Link
          href={`/my/installations/${item.id}`}
          className="inline-flex min-h-11 items-center rounded-field outline-none after:absolute after:inset-0 after:rounded-card hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-orange-text"
        >
          {format(text.open, { date: formatLongDate(item.created_at) ?? item.created_at })}
        </Link>
      </h2>
      <StepTrack completed={item.completed_milestones} total={item.total_milestones} />
      <progress className="sr-only" max={item.total_milestones} value={item.completed_milestones} aria-label={words} />
    </article>
  );
}
