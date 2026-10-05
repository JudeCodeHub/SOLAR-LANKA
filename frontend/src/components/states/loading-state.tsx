import { DialLoader } from "@/components/ui/dial-loader";
import { Skeleton } from "@/components/ui/skeleton";
import { messages } from "@/messages";
import { cn } from "@/lib/utils";

/** The loading convention: a status region. */
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
      <DialLoader className="size-8 self-center text-orange-text" />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} aria-hidden className="h-16 w-full" />
      ))}
    </div>
  );
}
