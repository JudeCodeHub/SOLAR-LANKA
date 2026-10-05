import { ARC_PATH, CENTRE, DETAILED, DETAIL_MIN_SIZE, LOCKUP, MARK_SIZE, RAYS, SMALL, TICKS, WORDMARK_PATH } from "@/lib/brand/logo";
import { messages } from "@/messages";

const ORANGE = "var(--ds-orange)";
const TICK = "var(--ds-text-2)";

/** The dial-and-sun mark; ticks and rays appear only from 32 px up, so it stays clear at 16 px. */
export function LogoMark({ size = 32, className, title }: { size?: number; className?: string; title?: string }) {
  const detailed = size >= DETAIL_MIN_SIZE;
  return (
    <svg viewBox={`0 0 ${MARK_SIZE} ${MARK_SIZE}`} width={size} height={size} className={className} {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })} data-logo="mark" data-detail={detailed}>
      <path d={ARC_PATH} fill="none" stroke={ORANGE} strokeWidth={detailed ? DETAILED.arcStroke : SMALL.arcStroke} strokeLinecap="round" />
      {detailed ? (
        <>
          {TICKS.map((tick) => (
            <line key={`${tick.x1}-${tick.y1}`} {...tick} stroke={TICK} strokeWidth={DETAILED.tickStroke} strokeLinecap="round" />
          ))}
          {RAYS.map((ray) => (
            <line key={`${ray.x1}-${ray.y1}`} {...ray} stroke={ORANGE} strokeWidth={DETAILED.rayStroke} strokeLinecap="round" />
          ))}
        </>
      ) : null}
      <circle cx={CENTRE} cy={CENTRE} r={detailed ? DETAILED.sunRadius : SMALL.sunRadius} fill={ORANGE} />
    </svg>
  );
}

/** The mark beside the Fraunces wordmark; the wordmark takes the surrounding text colour, so it works in both themes. */
export function Logo({ height = 32, className }: { height?: number; className?: string }) {
  const width = (height * LOCKUP.width) / LOCKUP.height;
  return (
    <svg viewBox={`0 0 ${LOCKUP.width} ${LOCKUP.height}`} width={width} height={height} className={className} role="img" aria-label={messages.app.name} data-logo="lockup">
      <g aria-hidden>
        <path d={ARC_PATH} fill="none" stroke={ORANGE} strokeWidth={DETAILED.arcStroke} strokeLinecap="round" />
        {TICKS.map((tick) => (
          <line key={`${tick.x1}-${tick.y1}`} {...tick} stroke={TICK} strokeWidth={DETAILED.tickStroke} strokeLinecap="round" />
        ))}
        {RAYS.map((ray) => (
          <line key={`${ray.x1}-${ray.y1}`} {...ray} stroke={ORANGE} strokeWidth={DETAILED.rayStroke} strokeLinecap="round" />
        ))}
        <circle cx={CENTRE} cy={CENTRE} r={DETAILED.sunRadius} fill={ORANGE} />
      </g>
      <path transform={`translate(${LOCKUP.x} ${LOCKUP.baseline})`} d={WORDMARK_PATH} fill="currentColor" />
    </svg>
  );
}
