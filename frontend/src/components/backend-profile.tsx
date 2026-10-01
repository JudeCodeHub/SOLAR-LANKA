"use client";

import { useAuth } from "@clerk/nextjs";

import { ApiErrorMessage } from "@/components/api-error-message";
import { SessionProblem } from "@/components/session-problem";
import { LoadingState } from "@/components/states/loading-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSessionState } from "@/lib/api/use-session";
import { roleLabel } from "@/lib/roles";
import { messages } from "@/messages";

/** The application's own record of the signed-in user, loaded through the API gateway. */
export function BackendProfile() {
  const { isSignedIn } = useAuth();
  const { state, query } = useSessionState(isSignedIn === true);
  const retry = () => void query.refetch();
  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>{messages.account.cardTitle}</CardTitle>
        <CardDescription>{messages.account.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {state.status === "loading" || state.status === "signed-out" ? <LoadingState /> : null}
        {state.status === "ready" && query.data ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <dt className="text-muted-foreground">{messages.account.role}</dt>
            <dd data-testid="backend-role">{roleLabel(state.user.role)}</dd>
            <dt className="text-muted-foreground">{messages.account.created}</dt>
            <dd>{new Date(query.data.created_at).toLocaleDateString("en-GB", { dateStyle: "long" })}</dd>
          </dl>
        ) : null}
        {state.status === "inactive" ? <SessionProblem kind="inactive" /> : null}
        {state.status === "rejected" ? (
          <SessionProblem kind="rejected" onRetry={retry} retrying={query.isRefetching} />
        ) : null}
        {state.status === "unavailable" && query.error ? (
          <ApiErrorMessage error={query.error} onRetry={retry} retrying={query.isRefetching} />
        ) : null}
      </CardContent>
    </Card>
  );
}
