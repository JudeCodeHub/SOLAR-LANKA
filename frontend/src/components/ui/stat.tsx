import { cn } from "@/lib/utils";

/** One headline figure: a label, the value in the figure font, its unit and an optional note. */
export function Stat({ label, value, unit, note, className }: { label: string; value: string; unit?: string; note?: string; className?: string }) {
  return (
    <div data-slot="stat" className={cn("space-y-1", className)}>
      <p className="type-small font-medium text-ink-2">{label}</p>
      <p className="type-figure text-3xl font-semibold text-ink">
        {value}
        {unit ? <span className="ml-1.5 text-base font-medium text-ink-2">{unit}</span> : null}
      </p>
      {note ? <p className="type-small text-ink-3">{note}</p> : null}
    </div>
  );
}
