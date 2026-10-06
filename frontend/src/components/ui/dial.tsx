import { DIAL_BOX, DIAL_CENTRE, arcPath, band, fraction, ticks } from "@/lib/dial/dial";
import { cn } from "@/lib/utils";
import { format, messages } from "@/messages";

const TRACK = arcPath();
const TICKS = ticks();

/** A meter dial: a figure with a sweeping arc, tick marks, the value and its unit, and a spoken description of all of it. */
export function Dial({
  label,
  value,
  from,
  min = 0,
  max,
  unit,
  display,
  size = 200,
  delay = 0,
  className,
}: {
  label: string;
  value: number;
  /** For a range: the lower end, so the arc covers the band from here to `value`. */
  from?: number;
  min?: number;
  max: number;
  unit: string;
  /** The value as it should be written, for example with a thousands separator; defaults to the number itself. */
  display?: string;
  size?: number;
  /** Milliseconds to wait before the sweep starts, so it can follow an entrance. */
  delay?: number;
  className?: string;
}) {
  const share = fraction(value, min, max);
  const span = from === undefined ? { start: 0, length: share * 100 } : band(from, value, min, max);
  const shown = display ?? String(value);
  // A range is written on two lines, the low end and then "to" the high end, so it stays inside the ring.
  const parts = shown.split(" to ");
  const lines = parts.length === 2 ? [parts[0] as string, `to ${parts[1]}`] : [shown];
  const spoken = format(messages.dial.description, { label, value: shown, unit, min, max });
  return (
    <figure data-slot="dial" data-fraction={share} style={delay > 0 ? ({ "--dial-delay": `${delay}ms` } as React.CSSProperties) : undefined} className={cn("inline-flex flex-col items-center gap-2", className)}>
      <svg viewBox={`0 0 ${DIAL_BOX} ${DIAL_BOX}`} width={size} height={size} role="img" aria-label={spoken}>
        <g aria-hidden>
          <path d={TRACK} fill="none" stroke="var(--ds-line)" strokeWidth={12} strokeLinecap="round" />
          {TICKS.map((tick) => (
            <line key={`${tick.x1}-${tick.y1}`} {...tick} stroke="var(--ds-muted)" strokeWidth={2} strokeLinecap="round" />
          ))}
          {span.length > 0 && (share > 0 || from !== undefined) ? <path d={TRACK} pathLength={100} fill="none" stroke="var(--ds-orange-text)" strokeWidth={12} strokeLinecap="round" strokeDasharray={`${span.length} 100`} strokeDashoffset={-span.start} className="dial-sweep" /> : null}
          {lines.length === 1 ? (
            <>
              <text x={DIAL_CENTRE} y={DIAL_CENTRE + 6} textAnchor="middle" fill="var(--ds-text)" className="type-figure" fontSize={shown.length <= 5 ? 38 : shown.length <= 9 ? 28 : 21} fontWeight={600}>
                {shown}
              </text>
              <text x={DIAL_CENTRE} y={DIAL_CENTRE + 30} textAnchor="middle" fill="var(--ds-text-2)" className="type-figure" fontSize={16}>
                {unit}
              </text>
            </>
          ) : (
            <>
              {lines.map((line, index) => (
                <text key={line} x={DIAL_CENTRE} y={DIAL_CENTRE - 10 + index * 28} textAnchor="middle" fill="var(--ds-text)" className="type-figure" fontSize={Math.max(...lines.map((entry) => entry.length)) <= 7 ? 28 : 22} fontWeight={600}>
                  {line}
                </text>
              ))}
              <text x={DIAL_CENTRE} y={DIAL_CENTRE + 60} textAnchor="middle" fill="var(--ds-text-2)" className="type-figure" fontSize={12}>
                {unit}
              </text>
            </>
          )}
        </g>
      </svg>
      <figcaption className="type-small font-medium text-ink-2">{label}</figcaption>
    </figure>
  );
}
