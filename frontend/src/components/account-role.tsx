"use client";

import { useAuth } from "@clerk/nextjs";

import { Skeleton } from "@/components/ui/skeleton";
import { describeError } from "@/lib/api/errors";
import { useSessionState } from "@/lib/api/use-session";
import { roleLabel } from "@/lib/roles";
import { messages } from "@/messages";

/** Small status badge for the header. Shares the cached current-user query with the account page. */
export function AccountRole() {
  const { isSignedIn } = useAuth();
  const { state, query } = useSessionState(isSignedIn === true);
  switch (state.status) {
    case "signed-out":
      return null;
    case "loading":
      return <Skeleton aria-hidden className="h-6 w-20 rounded-full" />;
    case "ready":
      return (
        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          {roleLabel(state.user.role)}
        </span>
      );
    case "inactive":
    case "rejected":
      // The account page explains this in full and offers the way forward.
      return (
        <span role="status" className="text-xs text-destructive">
          {messages.session.chip[state.status]}
        </span>
      );
    case "unavailable":
      return (
        <span role="status" className="text-xs text-destructive">
          {query.error ? describeError(query.error).title : null}
        </span>
      );
  }
}
