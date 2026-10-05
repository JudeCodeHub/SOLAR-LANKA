import { DIAL_BOX, DIAL_CENTRE, arcPath, fraction, ticks } from "@/lib/dial/dial";
import { cn } from "@/lib/utils";
import { format, messages } from "@/messages";

const TRACK = arcPath();
const TICKS = ticks();

/** A meter dial: a figure with a sweeping arc, tick marks, the value and its unit, and a spoken description of all of it. */
export function Dial({
  label,
  value,
  min = 0,
  max,
  unit,
  display,
  size = 200,
  className,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  unit: string;
  /** The value as it should be written, for example with a thousands separator; defaults to the number itself. */
  display?: string;
  size?: number;
  className?: string;
}) {
  const share = fraction(value, min, max);
  const shown = display ?? String(value);
  const spoken = format(messages.dial.description, { label, value: shown, unit, min, max });
  return (
    <figure data-slot="dial" data-fraction={share} className={cn("inline-flex flex-col items-center gap-2", className)}>
      <svg viewBox={`0 0 ${DIAL_BOX} ${DIAL_BOX}`} width={size} height={size} role="img" aria-label={spoken}>
        <g aria-hidden>
          <path d={TRACK} fill="none" stroke="var(--ds-line)" strokeWidth={12} strokeLinecap="round" />
          {TICKS.map((tick) => (
            <line key={`${tick.x1}-${tick.y1}`} {...tick} stroke="var(--ds-muted)" strokeWidth={2} strokeLinecap="round" />
          ))}
          {share > 0 ? <path d={TRACK} pathLength={100} fill="none" stroke="var(--ds-orange-text)" strokeWidth={12} strokeLinecap="round" strokeDasharray={`${share * 100} 100`} className="dial-sweep" /> : null}
          <text x={DIAL_CENTRE} y={DIAL_CENTRE + 6} textAnchor="middle" fill="var(--ds-text)" className="type-figure" fontSize={38} fontWeight={600}>
            {shown}
          </text>
          <text x={DIAL_CENTRE} y={DIAL_CENTRE + 30} textAnchor="middle" fill="var(--ds-text-2)" className="type-figure" fontSize={16}>
            {unit}
          </text>
        </g>
      </svg>
      <figcaption className="type-small font-medium text-ink-2">{label}</figcaption>
    </figure>
  );
}
