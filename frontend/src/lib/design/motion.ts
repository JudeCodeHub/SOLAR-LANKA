/** Every animation in the product and why it exists; the test in motion.test.ts fails when one is added without a line here. */
export interface MotionEntry {
  name: string;
  where: string;
  reason: string;
}

export const MOTION: MotionEntry[] = [
  { name: "shimmer-sweep", where: "Skeleton blocks while a page loads", reason: "Shows that content is on its way, so a blank block is not read as broken." },
  { name: "dial-spin", where: "DialLoader beside busy buttons and uploads", reason: "The only sign that a request is in flight after a click." },
  { name: "dial-sweep", where: "Meter dial in the hero, estimate results and the installation timeline", reason: "The needle moving to its value shows the figure is a reading on a scale." },
  { name: "page-out / page-in", where: "Page transition between routes", reason: "A short fade keeps the header and footer still and shows that the page changed." },
  { name: "hero-rise / hero-fade", where: "Landing hero, once on load", reason: "Brings the headline in before the photo so the eye reads the offer first." },
  { name: "reveal", where: "Landing sections as they scroll into view", reason: "Marks where a new section begins on a long page." },
  { name: "draw-line", where: "Connecting lines in the landing steps", reason: "The line draws in the direction of the steps, showing their order." },
  { name: "count-up", where: "Sample figures in the landing estimate teaser", reason: "Shows the figures are computed from the visitor's inputs, not typed copy." },
  { name: "animate-in / animate-out", where: "The phone menu sheet opening and closing", reason: "Shows where a panel came from and where it went, so focus moving is not a surprise." },
  { name: "colour transitions", where: "Buttons, links, tabs and cards on hover and focus", reason: "Confirms that the pointer is on something that can be used." },
];
