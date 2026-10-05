import { DIAL_BOX, arcPath } from "@/lib/dial/dial";
import { cn } from "@/lib/utils";

const ARC = arcPath();

/** A small dial that turns while something loads; it takes the surrounding text colour and is hidden from screen readers, so pair it with words. */
export function DialLoader({ className }: { className?: string }) {
  return (
    <svg data-slot="dial-loader" viewBox={`0 0 ${DIAL_BOX} ${DIAL_BOX}`} aria-hidden className={cn("size-5", className)}>
      <path d={ARC} fill="none" stroke="currentColor" strokeWidth={22} strokeLinecap="round" opacity={0.25} />
      <g className="dial-spin">
        <path d={ARC} pathLength={100} fill="none" stroke="currentColor" strokeWidth={22} strokeLinecap="round" strokeDasharray="30 100" />
      </g>
    </svg>
  );
}
