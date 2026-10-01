import type { Metadata } from "next";

import { EstimatorForm } from "@/components/estimator/estimator-form";
import { ScenarioGuidance } from "@/components/estimator/scenario-guidance";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.estimator };

export default function EstimatorPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {messages.estimator.title}
        </h1>
        <p className="text-muted-foreground">{messages.estimator.intro}</p>
      </header>
      <ScenarioGuidance />
      <EstimatorForm />
    </div>
  );
}
