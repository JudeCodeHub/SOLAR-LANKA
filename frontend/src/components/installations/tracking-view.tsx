"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { QueryState } from "@/components/query-state";
import { currentStepText, progressText } from "@/lib/installations/progress";
import { useInstallation } from "@/lib/quotation/customer-hooks";
import { messages } from "@/messages";

const text = messages.tracking;

/** The accepted installation and its steps; the first look after accepting an offer. */
export function TrackingView({ id, justAccepted }: { id: string; justAccepted: boolean }) {
  const query = useInstallation(id);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (justAccepted) heading.current?.focus();
  }, [justAccepted]);
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <Link href="/my/installations" className="text-sm underline underline-offset-2">
        {text.back}
      </Link>
      <h1 ref={heading} tabIndex={-1} className="font-heading text-3xl font-semibold tracking-tight outline-none">
        {text.title}
      </h1>
      {justAccepted ? (
        <p role="status" className="text-sm font-medium" data-accepted>
          {text.accepted}
        </p>
      ) : null}
      <QueryState query={query}>
        {(installation) => (
          <section aria-labelledby="steps-title" className="space-y-2">
            <p className="text-sm font-medium" data-progress>
              <span className="block">{progressText(installation.milestones.filter((m) => m.status === "completed").length, installation.milestones.length)}</span>
              <span className="block">{currentStepText(installation.milestones)}</span>
            </p>
            <h2 id="steps-title" className="font-heading text-xl font-semibold tracking-tight">
              {text.steps}
            </h2>
            <p className="text-sm text-muted-foreground">{text.intro}</p>
            <table className="w-full text-sm" data-steps>
              <caption className="sr-only">{text.steps}</caption>
              <thead>
                <tr className="border-b text-left">
                  <th scope="col" className="py-2 pr-3 font-medium">{text.step}</th>
                  <th scope="col" className="py-2 font-medium">{text.status}</th>
                </tr>
              </thead>
              <tbody>
                {[...installation.milestones]
                  .sort((a, b) => a.position - b.position)
                  .map((milestone) => (
                    <tr key={milestone.id} className="border-b last:border-0" data-step={milestone.status}>
                      <th scope="row" className="py-2 pr-3 text-left font-normal">{text.kinds[milestone.kind] ?? milestone.kind}</th>
                      <td className="py-2">{text.statuses[milestone.status] ?? milestone.status}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        )}
      </QueryState>
    </div>
  );
}
