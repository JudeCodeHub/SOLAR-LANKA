"use client";

import { BackLink } from "@/components/ui/back-link";
import { Table, TableRegion } from "@/components/ui/table";
import { CircleCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InstallationTimeline } from "@/components/installations/installation-timeline";
import { StepTrack } from "@/components/installations/installation-card";
import { useEffect, useRef } from "react";

import { CustomerVisits } from "@/components/visits/customer-visits";
import { QueryState } from "@/components/query-state";
import {
  currentStepText,
  progressText,
} from "@/lib/installations/progress";
import { useInstallation } from "@/lib/quotation/customer-hooks";
import { messages } from "@/messages";

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
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <BackLink href="/my/installations">{text.back}</BackLink>
      <header className="space-y-3 rounded-panel border border-line bg-surface p-6 shadow-e1" data-tracking-header>
        <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{text.eyebrow}</p>
        <h1 ref={heading} tabIndex={-1} className="type-display-m text-ink outline-none">
          {text.title}
        </h1>
        {justAccepted ? (
          <Alert variant="success" role="status" data-accepted>
            <CircleCheck aria-hidden />
            <AlertDescription>{text.accepted}</AlertDescription>
          </Alert>
        ) : null}
      </header>
      <QueryState query={query}>
        {(installation) => {
          const now = query.dataUpdatedAt;
          return (
            <>
              <section aria-labelledby="steps-title" className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6">
                <p className="type-body font-medium text-ink" data-progress>
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
                <StepTrack
                  completed={installation.milestones.filter((m) => m.status === "completed").length}
                  total={installation.milestones.length}
                />
                <h2 id="steps-title" className="type-heading text-ink">
                  {text.steps}
                </h2>
                <p className="type-small text-ink-2">{text.intro}</p>
                <TableRegion label={text.steps}>
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
                </TableRegion>
              </section>
              <CustomerVisits installationId={id} />
              <InstallationTimeline milestones={installation.milestones} history={installation.history} now={now} />
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
