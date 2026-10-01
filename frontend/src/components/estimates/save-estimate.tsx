"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRef } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { Button } from "@/components/ui/button";
import type { components } from "@/lib/api/schema";
import { useSessionState } from "@/lib/api/use-session";
import { useSaveEstimate } from "@/lib/estimates/hooks";
import { signInHref } from "@/lib/redirect";
import { useReturnPath } from "@/lib/use-return-path";
import { format, messages } from "@/messages";

const text = messages.estimator.save;

/**
 * Saving an estimate, for customers only. A signed-out visitor is offered sign-in (with a plain
 * note that the calculation is not carried across), and anyone who is not a customer sees nothing
 * because the backend would refuse them. Saving sends the inputs this result was calculated from;
 * the server recalculates and stores the snapshot, so if the estimator settings changed in the
 * meantime the saved figures can differ and the page says so.
 */
export function SaveEstimate(props: SaveProps) {
  const { isSignedIn } = useAuth();
  return <SaveEstimateControl {...props} signedIn={isSignedIn} />;
}

interface SaveProps {
  request: components["schemas"]["EstimatorInputs-Input"];
  shownVersion: number;
}

/** `signedIn` is undefined while Clerk is still loading. */
export function SaveEstimateControl({
  request,
  shownVersion,
  signedIn,
}: SaveProps & { signedIn: boolean | undefined }) {
  const { state } = useSessionState(signedIn === true);
  const returnPath = useReturnPath();
  const save = useSaveEstimate();
  // Synchronous guard: React state is too slow to stop two clicks in the same moment.
  const inFlight = useRef(false);

  if (signedIn === false) {
    return (
      <p className="text-sm">
        <Link href={signInHref(returnPath)} className="underline underline-offset-2">
          {text.signIn}
        </Link>
        <span className="block text-muted-foreground">{text.signInNote}</span>
      </p>
    );
  }
  if (signedIn !== true || state.status !== "ready" || state.user.role !== "customer") {
    return null;
  }

  const saved = save.data;
  const onSave = () => {
    if (inFlight.current || saved) return;
    inFlight.current = true;
    save.mutate(request, {
      onSettled: () => {
        inFlight.current = false;
      },
    });
  };

  return (
    <div className="space-y-2 text-sm">
      {saved ? (
        <div role="status" className="space-y-1">
          <p className="font-medium">{text.saved}</p>
          <Link href={`/my/estimates/${saved.id}`} className="underline underline-offset-2">
            {text.open}
          </Link>
          {saved.estimate.config_version !== shownVersion ? (
            <p className="text-muted-foreground">
              {format(text.differs, { saved: saved.estimate.config_version, shown: shownVersion })}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <Button type="button" onClick={onSave} aria-disabled={save.isPending} data-pending={save.isPending}>
            {text.button}
          </Button>
          <p className="text-muted-foreground">{text.note}</p>
        </>
      )}
      {save.isError ? <ApiErrorMessage error={save.error} /> : null}
    </div>
  );
}
