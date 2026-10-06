"use client";

import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DialLoader } from "@/components/ui/dial-loader";
import { Photo } from "@/components/ui/photo";
import { formatLongDate } from "@/lib/catalogue/detail";
import { stepName, stepPhoto } from "@/lib/installations/progress";
import { isStatusChange, scheduleFor, updatesFor, type UpdateLike } from "@/lib/installations/timeline";
import { cn } from "@/lib/utils";
import { format, messages, plural } from "@/messages";

const text = messages.tracking;

interface MilestoneLike {
  id: string;
  kind: string;
  position: number;
  status: string;
  evidence?: readonly unknown[] | null;
}

const TONES: Record<string, "success" | "info" | "neutral"> = { completed: "success", in_progress: "info", pending: "neutral" };

/** The steps as a vertical timeline: a node on a line for each step (done, in progress, not started), its photo, its notes, delays, evidence and updates. */
export function InstallationTimeline({ milestones, history, now }: { milestones: readonly MilestoneLike[]; history: readonly UpdateLike[]; now: number }) {
  const date = (iso: string) => formatLongDate(iso) ?? iso;
  return (
    <section aria-labelledby="timeline-title" className="space-y-4" data-timeline>
      <h2 id="timeline-title" className="type-heading text-ink">
        {text.timeline.title}
      </h2>
      <p className="type-body max-w-reading text-ink-2">{text.timeline.intro}</p>
      <ol className="relative space-y-5 before:absolute before:top-3 before:bottom-3 before:left-4 before:w-0.5 before:bg-line">
        {[...milestones]
          .sort((a, b) => a.position - b.position)
          .map((milestone) => {
            const updates = updatesFor(history, milestone.id);
            const schedule = scheduleFor(updates, now);
            const evidence = milestone.evidence?.length ?? 0;
            const status = milestone.status;
            return (
              <li key={milestone.id} className="relative pl-12" data-milestone={status}>
                <span
                  aria-hidden
                  data-node={status}
                  className={cn(
                    "absolute top-3 left-0 grid size-8 place-items-center rounded-full border-2",
                    status === "completed" ? "border-orange-text bg-orange-text text-on-orange" : status === "in_progress" ? "border-orange-text bg-surface text-orange-text" : "border-field-border bg-surface text-ink-3",
                  )}
                >
                  {status === "completed" ? <Check className="size-4" /> : status === "in_progress" ? <DialLoader className="size-5" /> : null}
                </span>
                <div className="overflow-hidden rounded-card border border-line bg-surface text-sm shadow-e1">
                  <div aria-hidden className="hidden md:block">
                    <Photo name={stepPhoto(milestone.kind)} sizes="(min-width: 768px) 640px, 0px" className="h-24 w-full object-cover" />
                  </div>
                  <div className="space-y-2 p-4">
                    <h3 className="type-subheading flex flex-wrap items-center gap-3 text-ink">
                      {stepName(milestone.kind)}
                      <Badge variant={TONES[status] ?? "neutral"} data-status>
                        {text.statuses[status] ?? status}
                      </Badge>
                    </h3>
                    {schedule?.nextAction ? <p data-next-action>{format(text.timeline.nextAction, { action: schedule.nextAction })}</p> : null}
                    {schedule?.delayUntil ? (
                      <p className="font-medium text-warning" data-delay={schedule.delayed ? "current" : "past"}>
                        {format(schedule.delayed ? text.timeline.delayedUntil : text.timeline.wasDelayedUntil, { date: date(schedule.delayUntil) })}
                      </p>
                    ) : null}
                    <p className="text-ink-2" data-evidence>
                      {evidence > 0 ? format(plural(text.timeline.evidence, evidence), { count: evidence }) : text.timeline.noEvidence}
                    </p>
                    {updates.length === 0 ? (
                      <p className="text-ink-2" data-no-updates>
                        {text.timeline.noUpdates}
                      </p>
                    ) : (
                      <ul className="space-y-2 border-l-2 border-line pl-3" aria-label={text.timeline.updates}>
                        {updates.map((entry) => (
                          <li key={entry.id} data-update={isStatusChange(entry) ? "status" : "note"}>
                            <span className="block text-ink-2">{date(entry.created_at)}</span>
                            <span className="block">
                              {isStatusChange(entry)
                                ? format(text.timeline.moved, { from: text.statuses[entry.from_status] ?? entry.from_status, to: text.statuses[entry.to_status] ?? entry.to_status })
                                : text.timeline.note}
                            </span>
                            {entry.reason ? <span className="block">{format(text.timeline.reason, { reason: entry.reason })}</span> : null}
                            {entry.next_action ? <span className="block">{format(text.timeline.nextAction, { action: entry.next_action })}</span> : null}
                            {entry.delay_until ? <span className="block">{format(text.timeline.delayedUntil, { date: date(entry.delay_until) })}</span> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
      </ol>
    </section>
  );
}
