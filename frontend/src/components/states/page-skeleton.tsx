import { DialLoader } from "@/components/ui/dial-loader";
import { Skeleton, SkeletonCard, SkeletonText } from "@/components/ui/skeleton";
import { messages } from "@/messages";
import { cn } from "@/lib/utils";

/** The shape of a page while it loads: a header block, then cards, table rows or a form column. */
export function PageSkeleton({ variant = "cards", label = messages.states.loading, className }: { variant?: "cards" | "table" | "form"; label?: string; className?: string }) {
  return (
    <div role="status" aria-busy="true" data-page-skeleton={variant} className={cn("mx-auto w-full max-w-wide space-y-10 px-4 py-12 sm:px-6", className)}>
      <span className="sr-only">{label}</span>
      <div aria-hidden className="space-y-4">
        <div className="flex items-center gap-3">
          <DialLoader className="size-5 text-orange-text" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-10 w-2/3 max-w-xl" />
        <SkeletonText lines={2} className="max-w-xl" />
      </div>
      {variant === "cards" ? (
        <div aria-hidden className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : null}
      {variant === "table" ? (
        <div aria-hidden className="space-y-2 rounded-card border border-line bg-surface p-4">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full opacity-70" />
          ))}
        </div>
      ) : null}
      {variant === "form" ? (
        <div aria-hidden className="max-w-xl space-y-5 rounded-card border border-line bg-surface p-6">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
          <Skeleton className="h-11 w-40 rounded-full" />
        </div>
      ) : null}
    </div>
  );
}
