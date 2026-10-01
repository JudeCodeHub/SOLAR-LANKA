import { Info } from "lucide-react";

import { messages } from "@/messages";

/** The demonstration notice, kept prominent so fictional data is never mistaken for real. */
export function DemoStatus() {
  const text = messages.landing.demoStatus;
  return (
    <section
      aria-labelledby="demo-status-title"
      className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
    >
      <Info aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div>
        <h2 id="demo-status-title" className="font-medium">
          {text.title}
        </h2>
        <p className="mt-1">{text.body}</p>
      </div>
    </section>
  );
}
