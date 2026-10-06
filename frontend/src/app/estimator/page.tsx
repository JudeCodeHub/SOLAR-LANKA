import type { Metadata } from "next";

import { EstimatorForm } from "@/components/estimator/estimator-form";
import { ScenarioGuidance } from "@/components/estimator/scenario-guidance";
import { Photo } from "@/components/ui/photo";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.estimator };

export default function EstimatorPage() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-10 sm:px-6" data-estimator-page>
      <header className="relative isolate overflow-hidden rounded-panel border border-line bg-paper-2">
        <div aria-hidden className="absolute inset-y-0 right-0 -z-10 hidden w-1/2 md:block">
          <Photo name="roofPlan" sizes="50vw" priority className="size-full object-cover dark:brightness-90" />
          <div className="absolute inset-0 bg-gradient-to-r from-paper-2 via-paper-2/40 to-transparent" />
        </div>
        <div className="max-w-xl space-y-3 p-6 sm:p-10">
          <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{messages.estimator.eyebrow}</p>
          <h1 className="type-display-m text-ink">{messages.estimator.title}</h1>
          <p className="type-body text-ink-2">{messages.estimator.intro}</p>
        </div>
      </header>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 lg:order-1">
          <EstimatorForm />
        </div>
        <div className="lg:sticky lg:top-24 lg:order-2">
          <ScenarioGuidance />
        </div>
      </div>
    </div>
  );
}
