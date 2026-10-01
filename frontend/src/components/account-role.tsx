"use client";

import { useAuth } from "@clerk/nextjs";

import { Skeleton } from "@/components/ui/skeleton";
import { describeError } from "@/lib/api/errors";
import { useCurrentUser } from "@/lib/api/hooks";
import { roleLabel } from "@/lib/roles";

/** Small role badge for the header. Shares the cached current-user query with the account page. */
export function AccountRole() {
  const { isSignedIn } = useAuth();
  const query = useCurrentUser({ enabled: isSignedIn === true });
  if (!isSignedIn) {
    return null;
  }
  if (query.isPending) {
    return <Skeleton aria-hidden className="h-6 w-20 rounded-full" />;
  }
  if (query.isError) {
    // Not worth an alert in the header; the account page shows the full error with a retry.
    return (
      <span role="status" className="text-xs text-destructive">
        {describeError(query.error).title}
      </span>
    );
  }
  return (
    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
      {roleLabel(query.data.role)}
    </span>
  );
}
