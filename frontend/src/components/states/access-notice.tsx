"use client";

import { SignOutButton } from "@clerk/nextjs";
import { Lock, LogIn, RefreshCw, UserX, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { StatePanel } from "@/components/states/state-panel";
import { Button } from "@/components/ui/button";
import { signInHref } from "@/lib/redirect";
import { useReturnPath } from "@/lib/use-return-path";
import { messages } from "@/messages";

export type AccessKind = "signed-out" | "not-allowed" | "inactive" | "rejected";

const ICONS: Record<AccessKind, LucideIcon> = { "signed-out": LogIn, "not-allowed": Lock, inactive: UserX, rejected: RefreshCw };

/** What happened and what to do next when someone cannot see a page: signed out, not allowed, account unavailable, or a session the server did not accept. */
export function AccessNotice({
  kind,
  title,
  description,
  onRetry,
  retrying = false,
  className,
}: {
  kind: AccessKind;
  title: string;
  description: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  const returnPath = useReturnPath();
  const actions = (
    <>
      {kind === "signed-out" ? (
        <>
          <Button asChild>
            <Link href={signInHref(returnPath)}>{messages.auth.signIn}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/sign-up">{messages.auth.createAccount}</Link>
          </Button>
        </>
      ) : null}
      {kind === "not-allowed" ? (
        <Button asChild variant="outline">
          <Link href="/">{messages.pages.notFound.home}</Link>
        </Button>
      ) : null}
      {kind === "rejected" && onRetry ? (
        <Button variant="outline" onClick={onRetry} disabled={retrying}>
          {retrying ? messages.states.retrying : messages.session.rejected.retry}
        </Button>
      ) : null}
      {kind === "rejected" || kind === "inactive" ? (
        <SignOutButton redirectUrl={kind === "rejected" ? "/sign-in" : "/"}>
          <Button variant="outline">{kind === "rejected" ? messages.session.rejected.signInAgain : messages.session.inactive.signOut}</Button>
        </SignOutButton>
      ) : null}
    </>
  );
  return (
    <StatePanel
      icon={ICONS[kind]}
      tone={kind === "signed-out" ? "orange" : "danger"}
      heading="h2"
      title={title}
      description={description}
      action={actions}
      role={kind === "rejected" || kind === "inactive" ? "alert" : "status"}
      data-access={kind}
      className={className}
    />
  );
}
