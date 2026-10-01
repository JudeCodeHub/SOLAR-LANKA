import { Skeleton } from "@/components/ui/skeleton";
import { messages } from "@/messages";
import { cn } from "@/lib/utils";

/**
 * The loading convention: a status region (announced to screen readers, marked busy) containing
 * placeholder shapes. Pass `lines` to roughly match the content that will replace it, so the
 * page does not jump when data arrives.
 */
export function LoadingState({
  label = messages.states.loading,
  lines = 1,
  className,
}: {
  label?: string;
  lines?: number;
  className?: string;
}) {
  return (
    <div role="status" aria-busy="true" className={cn("flex flex-col gap-3", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} aria-hidden className="h-16 w-full" />
      ))}
    </div>
  );
}
