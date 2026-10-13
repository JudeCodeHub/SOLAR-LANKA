import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

import type { JourneyStep } from "@/lib/dashboard/dashboard";
import { cn } from "@/lib/utils";
import { format, messages, plural } from "@/messages";

const text = messages.dashboard.customer.journey;

/** The customer's four stages as a track: finished ones are filled, the current one is marked and links to what to do next. */
export function Journey({ steps, loading }: { steps: JourneyStep[]; loading: boolean }) {
  const done = steps.filter((step) => step.state === "done").length;
  return (
    <section aria-labelledby="journey-title" aria-busy={loading} className="space-y-5 rounded-panel border border-line bg-surface p-5 shadow-e1 sm:p-7" data-journey>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="journey-title" className="type-heading text-ink">
          {text.title}
        </h2>
        {loading ? null : <p className="text-sm font-medium text-ink-2">{format(text.progress, { done, total: steps.length })}</p>}
      </div>
      <div aria-hidden className="h-2 overflow-hidden rounded-full bg-paper-2">
        <div className="h-full rounded-full bg-orange transition-[width] duration-700 motion-reduce:transition-none" style={{ width: loading ? "0%" : `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => {
          const copy = text.steps[step.id];
          const current = !loading && step.state === "current";
          const finished = !loading && step.state === "done";
          const note = step.count && step.count > 0 ? format(plural(copy.some, step.count), { count: step.count }) : copy.none;
          return (
            <li key={step.id} aria-current={current ? "step" : undefined} className={cn("flex flex-col gap-2 rounded-card border p-4", current ? "border-orange bg-orange-tint" : "border-line bg-paper")} data-step={step.id} data-state={loading ? "loading" : step.state}>
              <span className={cn("grid size-9 place-items-center rounded-full text-sm font-semibold", finished ? "bg-orange text-on-orange" : current ? "border-2 border-orange-text text-orange-text" : "border border-line text-ink-2")}>
                {finished ? <Check aria-hidden className="size-5" /> : index + 1}
              </span>
              <p className="font-heading text-lg font-semibold text-ink">{copy.label}</p>
              <p className="text-sm text-ink-2">{note}</p>
              {loading ? null : (
                <p className="mt-auto pt-1 text-xs font-semibold tracking-widest uppercase text-ink-2">{finished ? text.done : current ? text.here : text.upcoming}</p>
              )}
              {current ? (
                <Link href={step.href} className="inline-flex min-h-11 items-center gap-1.5 font-medium text-orange-text underline-offset-4 hover:underline">
                  {copy.action}
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
