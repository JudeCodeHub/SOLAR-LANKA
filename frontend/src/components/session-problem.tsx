"use client";

import { SignOutButton } from "@clerk/nextjs";
import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messages } from "@/messages";

/**
 * What to show when Clerk says the user is signed in but the backend will not serve them.
 *
 * "inactive" (the account is suspended or no longer active): nothing the user can retry, so the
 * way out is to sign out. "rejected" (the session was not accepted, for example because it
 * expired): trying again can help, and signing out and in again always does.
 * This explains the situation; it never works around the backend's refusal.
 */
export function SessionProblem({
  kind,
  onRetry,
  retrying = false,
}: {
  kind: "inactive" | "rejected";
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const text = messages.session[kind];
  return (
    <Alert variant="destructive">
      <TriangleAlert aria-hidden />
      <AlertTitle>{text.title}</AlertTitle>
      <AlertDescription>
        <p>{text.message}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {kind === "rejected" && onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
              {retrying ? messages.states.retrying : messages.session.rejected.retry}
            </Button>
          ) : null}
          <SignOutButton redirectUrl={kind === "rejected" ? "/sign-in" : "/"}>
            <Button variant="outline" size="sm">
              {kind === "rejected"
                ? messages.session.rejected.signInAgain
                : messages.session.inactive.signOut}
            </Button>
          </SignOutButton>
        </div>
      </AlertDescription>
    </Alert>
  );
}
