import { Dial } from "@/components/ui/dial";
import { niceMax } from "@/lib/dial/dial";
import { rangeDisplay, type Preview, widen } from "@/lib/estimator/results";
import { messages } from "@/messages";

const text = messages.estimator.results.hero;

/** The headline of an estimate: two dials, one for the system's size and one for its yearly generation, each showing the range the estimate gives. */
export function ResultsHero({ preview }: { preview: Preview }) {
  const capacity = widen(preview.sizing.capacity_kwp, 2);
  const annual = preview.sizing.annual_generation_kwh ? widen(preview.sizing.annual_generation_kwh, 0) : null;
  return (
    <div className="grid gap-6 rounded-panel border border-line bg-surface p-6 shadow-e2 sm:grid-cols-2" data-results-hero>
      <div className="flex justify-center">
        <Dial
          label={text.capacity}
          value={capacity[1]}
          from={capacity[0]}
          max={niceMax(capacity[1])}
          unit={text.capacityUnit}
          display={rangeDisplay(preview.sizing.capacity_kwp, 2)}
          size={220}
        />
      </div>
      <div className="flex justify-center">
        {annual && preview.sizing.annual_generation_kwh ? (
          <Dial
            label={text.annual}
            value={annual[1]}
            from={annual[0]}
            max={niceMax(annual[1])}
            unit={text.annualUnit}
            display={rangeDisplay(preview.sizing.annual_generation_kwh, 0)}
            size={220}
            delay={300}
          />
        ) : (
          <div className="flex max-w-xs flex-col items-center justify-center gap-2 rounded-card border border-dashed border-field-border bg-paper-2 p-6 text-center" data-hero-missing>
            <p className="type-subheading text-ink">{text.annual}</p>
            <p className="type-small text-ink-2">{messages.estimator.results.why.needsShading}</p>
          </div>
        )}
      </div>
    </div>
  );
}
