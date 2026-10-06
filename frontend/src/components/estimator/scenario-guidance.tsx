import { messages } from "@/messages";

const text = messages.estimator.guidance;

/** What the estimator covers and what the form's defaults mean, shown before the form. */
export function ScenarioGuidance() {
  return (
    <section aria-labelledby="guidance-title" className="space-y-3 rounded-card border border-line bg-paper-2 p-5 text-sm">
      <h2 id="guidance-title" className="type-subheading text-ink">
        {text.title}
      </h2>
      <p className="text-ink">{text.supported}</p>
      <p className="text-ink-2">{text.netMetering}</p>
      <p className="text-ink-2">{text.netAccounting}</p>
      <p className="text-ink-2">{text.netPlus}</p>
      <p className="text-ink-2">{text.feedInRate}</p>
      <p className="text-ink-2" data-new-connections>
        {text.newConnections}
      </p>
      <p className="text-ink-2">{text.deferred}</p>
      <h3 className="font-semibold text-ink">{text.defaultsTitle}</h3>
      <p className="text-ink-2">{text.defaults}</p>
      <p className="text-ink-2">{text.unknown}</p>
      <p className="text-ink-2">{text.planning}</p>
      <p className="type-caption text-ink-3">{text.source}</p>
    </section>
  );
}
