/** Geometry for the meter dial: a 270 degree arc, open at the bottom, drawn in a 200 by 200 box. */

export const DIAL_BOX = 200;
export const DIAL_CENTRE = 100;
export const DIAL_RADIUS = 80;
export const DIAL_TICKS = 11;
/** The arc starts at the bottom left (135 degrees) and sweeps 270 degrees clockwise to the bottom right. */
const START = 135;
const SWEEP = 270;

const point = (radius: number, degrees: number) => {
  const radians = (degrees * Math.PI) / 180;
  return { x: Number((DIAL_CENTRE + radius * Math.cos(radians)).toFixed(2)), y: Number((DIAL_CENTRE + radius * Math.sin(radians)).toFixed(2)) };
};

/** The path of the whole arc; the value arc is the same path drawn part way with a dash. */
export function arcPath(radius = DIAL_RADIUS): string {
  const start = point(radius, START);
  const end = point(radius, START + SWEEP);
  return `M${start.x} ${start.y}A${radius} ${radius} 0 1 1 ${end.x} ${end.y}`;
}

/** The share of the range that the value covers, from 0 to 1; a value outside the range or a flat range is held to the nearest end. */
export function fraction(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !(max > min)) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** Tick marks just inside the arc, evenly spaced from the first end to the last. */
export function ticks(): { x1: number; y1: number; x2: number; y2: number }[] {
  return Array.from({ length: DIAL_TICKS }, (_, index) => {
    const degrees = START + (SWEEP / (DIAL_TICKS - 1)) * index;
    const inner = point(DIAL_RADIUS - 22, degrees);
    const outer = point(DIAL_RADIUS - 14, degrees);
    return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y };
  });
}
