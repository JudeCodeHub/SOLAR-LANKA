"use client";

import { useAuth } from "@clerk/nextjs";

import { QueryState } from "@/components/query-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUser } from "@/lib/api/hooks";
import { roleLabel } from "@/lib/roles";
import { messages } from "@/messages";

/** The application's own record of the signed-in user, loaded through the API gateway. */
export function BackendProfile() {
  const { isSignedIn } = useAuth();
  const query = useCurrentUser({ enabled: isSignedIn === true });
  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>{messages.account.cardTitle}</CardTitle>
        <CardDescription>{messages.account.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        <QueryState query={query}>
          {(user) => (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
              <dt className="text-muted-foreground">{messages.account.role}</dt>
              <dd data-testid="backend-role">{roleLabel(user.role)}</dd>
              <dt className="text-muted-foreground">{messages.account.created}</dt>
              <dd>{new Date(user.created_at).toLocaleDateString("en-GB", { dateStyle: "long" })}</dd>
            </dl>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}
