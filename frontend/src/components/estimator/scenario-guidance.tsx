import { messages } from "@/messages";

const text = messages.estimator.guidance;

/** What the estimator covers and what the form's defaults mean, shown before the form. */
export function ScenarioGuidance() {
  return (
    <section aria-labelledby="guidance-title" className="space-y-3 rounded-lg border bg-card p-4 text-sm">
      <h2 id="guidance-title" className="font-heading text-lg font-semibold tracking-tight">
        {text.title}
      </h2>
      <p>{text.supported}</p>
      <p className="text-muted-foreground">{text.netMetering}</p>
      <p className="text-muted-foreground">{text.netAccounting}</p>
      <p className="text-muted-foreground">{text.netPlus}</p>
      <p className="text-muted-foreground">{text.feedInRate}</p>
      <p className="text-muted-foreground">{text.deferred}</p>
      <h3 className="font-medium">{text.defaultsTitle}</h3>
      <p className="text-muted-foreground">{text.defaults}</p>
      <p className="text-muted-foreground">{text.unknown}</p>
      <p className="text-muted-foreground">{text.planning}</p>
      <p className="text-xs text-muted-foreground">{text.source}</p>
    </section>
  );
}
