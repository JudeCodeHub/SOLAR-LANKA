import { cn } from "cn"

/** A placeholder block that sweeps a soft light across itself and holds still under reduced motion. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("shimmer rounded-field", className)} {...props} />
}

/** Lines of text, the last one shorter. */
function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn("h-4", index === lines - 1 && lines > 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  )
}

/** A card-shaped placeholder: an image area and a few lines. */
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("space-y-4 rounded-card border border-line bg-surface p-4", className)}>
      <Skeleton className="h-32 w-full" />
      <SkeletonText lines={3} />
    </div>
  )
}

export { Skeleton, SkeletonText, SkeletonCard }
