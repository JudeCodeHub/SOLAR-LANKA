import { cn } from "@/lib/utils";

/** A thin bar from zero up to a scale top with the range between two values filled in; a range of one value is drawn as a single mark. */
export function RangeBar({ low, high, max, className }: { low: number; high: number; max: number; className?: string }) {
  const top = max > 0 ? max : 1;
  const start = Math.min(Math.max(low / top, 0), 1) * 100;
  const end = Math.min(Math.max(high / top, 0), 1) * 100;
  const single = low === high;
  return (
    <span aria-hidden data-range-bar={single ? "single" : "range"} className={cn("relative block h-2.5 w-full max-w-56 rounded-full bg-paper-2 ring-1 ring-line ring-inset", className)}>
      {single ? (
        <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-orange-text" style={{ left: `${Math.min(Math.max(start, 3), 97)}%` }} />
      ) : (
        <span className="absolute inset-y-0 rounded-full bg-orange-text" style={{ left: `${start}%`, width: `${Math.max(end - start, 3)}%` }} />
      )}
    </span>
  );
}
