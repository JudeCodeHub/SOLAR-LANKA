"use client";

import { Table } from "@/components/ui/table";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { CustomerVisits } from "@/components/visits/customer-visits";
import { QueryState } from "@/components/query-state";
import {
  currentStepText,
  progressText,
  stepName,
} from "@/lib/installations/progress";
import { useInstallation } from "@/lib/quotation/customer-hooks";
import { formatLongDate } from "@/lib/catalogue/detail";
import {
  isStatusChange,
  scheduleFor,
  updatesFor,
} from "@/lib/installations/timeline";
import { format, messages, plural } from "@/messages";

const text = messages.tracking;

/** The accepted installation and its steps; the first look after accepting an offer. */
export function TrackingView({
  id,
  justAccepted,
}: {
  id: string;
  justAccepted: boolean;
}) {
  const query = useInstallation(id);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (justAccepted) heading.current?.focus();
  }, [justAccepted]);
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <Link
        href="/my/installations"
        className="inline-flex min-h-11 items-center text-sm underline underline-offset-2"
      >
        {text.back}
      </Link>
      <h1
        ref={heading}
        tabIndex={-1}
        className="font-heading text-3xl font-semibold tracking-tight outline-none"
      >
        {text.title}
      </h1>
      {justAccepted ? (
        <p role="status" className="text-sm font-medium" data-accepted>
          {text.accepted}
        </p>
      ) : null}
      <QueryState query={query}>
        {(installation) => {
          const now = query.dataUpdatedAt;
          const date = (iso: string) => formatLongDate(iso) ?? iso;
          return (
            <>
              <section aria-labelledby="steps-title" className="space-y-2">
                <p className="text-sm font-medium" data-progress>
                  <span className="block">
                    {progressText(
                      installation.milestones.filter(
                        (m) => m.status === "completed",
                      ).length,
                      installation.milestones.length,
                    )}
                  </span>
                  <span className="block">
                    {currentStepText(installation.milestones)}
                  </span>
                </p>
                <h2
                  id="steps-title"
                  className="font-heading text-xl font-semibold tracking-tight"
                >
                  {text.steps}
                </h2>
                <p className="text-sm text-muted-foreground">{text.intro}</p>
                <Table className="w-full text-sm" data-steps>
                  <caption className="sr-only">{text.steps}</caption>
                  <thead>
                    <tr className="border-b text-left">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        {text.step}
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        {text.status}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...installation.milestones]
                      .sort((a, b) => a.position - b.position)
                      .map((milestone) => (
                        <tr
                          key={milestone.id}
                          className="border-b last:border-0"
                          data-step={milestone.status}
                        >
                          <th
                            scope="row"
                            className="py-2 pr-3 text-left font-normal"
                          >
                            {text.kinds[milestone.kind] ?? milestone.kind}
                          </th>
                          <td className="py-2">
                            {text.statuses[milestone.status] ??
                              milestone.status}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </Table>
              </section>
              <CustomerVisits installationId={id} />
              <section
                aria-labelledby="timeline-title"
                className="space-y-3"
                data-timeline
              >
                <h2
                  id="timeline-title"
                  className="font-heading text-xl font-semibold tracking-tight"
                >
                  {text.timeline.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {text.timeline.intro}
                </p>
                <ol className="space-y-3">
                  {[...installation.milestones]
                    .sort((a, b) => a.position - b.position)
                    .map((milestone) => {
                      const updates = updatesFor(
                        installation.history,
                        milestone.id,
                      );
                      const schedule = scheduleFor(updates, now);
                      const evidence = milestone.evidence?.length ?? 0;
                      return (
                        <li
                          key={milestone.id}
                          className="space-y-2 rounded-lg border p-3 text-sm"
                          data-milestone={milestone.status}
                        >
                          <h3 className="font-medium">
                            {stepName(milestone.kind)}
                            <span
                              className="ml-2 rounded-full border px-2 py-0.5 text-xs font-normal"
                              data-status
                            >
                              {text.statuses[milestone.status] ??
                                milestone.status}
                            </span>
                          </h3>
                          {schedule?.nextAction ? (
                            <p data-next-action>
                              {format(text.timeline.nextAction, {
                                action: schedule.nextAction,
                              })}
                            </p>
                          ) : null}
                          {schedule?.delayUntil ? (
                            <p
                              className="font-medium"
                              data-delay={schedule.delayed ? "current" : "past"}
                            >
                              {format(
                                schedule.delayed
                                  ? text.timeline.delayedUntil
                                  : text.timeline.wasDelayedUntil,
                                { date: date(schedule.delayUntil) },
                              )}
                            </p>
                          ) : null}
                          <p className="text-muted-foreground" data-evidence>
                            {evidence > 0
                              ? format(
                                  plural(text.timeline.evidence, evidence),
                                  { count: evidence },
                                )
                              : text.timeline.noEvidence}
                          </p>
                          {updates.length === 0 ? (
                            <p
                              className="text-muted-foreground"
                              data-no-updates
                            >
                              {text.timeline.noUpdates}
                            </p>
                          ) : (
                            <ul
                              className="space-y-1 border-l pl-3"
                              aria-label={text.timeline.updates}
                            >
                              {updates.map((entry) => (
                                <li
                                  key={entry.id}
                                  data-update={
                                    isStatusChange(entry) ? "status" : "note"
                                  }
                                >
                                  <span className="block text-muted-foreground">
                                    {date(entry.created_at)}
                                  </span>
                                  <span className="block">
                                    {isStatusChange(entry)
                                      ? format(text.timeline.moved, {
                                          from:
                                            text.statuses[entry.from_status] ??
                                            entry.from_status,
                                          to:
                                            text.statuses[entry.to_status] ??
                                            entry.to_status,
                                        })
                                      : text.timeline.note}
                                  </span>
                                  {entry.reason ? (
                                    <span className="block">
                                      {format(text.timeline.reason, {
                                        reason: entry.reason,
                                      })}
                                    </span>
                                  ) : null}
                                  {entry.next_action ? (
                                    <span className="block">
                                      {format(text.timeline.nextAction, {
                                        action: entry.next_action,
                                      })}
                                    </span>
                                  ) : null}
                                  {entry.delay_until ? (
                                    <span className="block">
                                      {format(text.timeline.delayedUntil, {
                                        date: date(entry.delay_until),
                                      })}
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                </ol>
              </section>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
