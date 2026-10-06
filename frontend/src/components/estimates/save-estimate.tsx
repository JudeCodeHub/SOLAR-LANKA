"use client";

import { useAuth } from "@clerk/nextjs";
import { CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import type { components } from "@/lib/api/schema";
import { useSessionState } from "@/lib/api/use-session";
import { useSaveEstimate } from "@/lib/estimates/hooks";
import { prepareHref } from "@/lib/requests/prepare";
import { signInHref } from "@/lib/redirect";
import { useReturnPath } from "@/lib/use-return-path";
import { cn } from "@/lib/utils";
import { format, messages } from "@/messages";

const text = messages.estimator.save;

const PANEL = "flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-e1";

/** Saving an estimate, for customers only. */
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
      <div className={PANEL} data-save-panel>
        <Link href={signInHref(returnPath)} className={cn(buttonVariants({ variant: "secondary" }), "w-fit")}>
          {text.signIn}
        </Link>
        <p className="type-small text-ink-2">{text.signInNote}</p>
      </div>
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
    <div className={PANEL} data-save-panel>
      {saved ? (
        <div role="status" className="space-y-3">
          <Alert variant="success" role="presentation" data-saved>
            <CircleCheck aria-hidden />
            <AlertTitle>{text.saved}</AlertTitle>
          </Alert>
          <div className="flex flex-wrap gap-3">
            <Link href={prepareHref(saved.id)} className={buttonVariants()} data-prepare>
              {text.prepare}
            </Link>
            <Link href={`/my/estimates/${saved.id}`} className={buttonVariants({ variant: "secondary" })}>
              {text.open}
            </Link>
          </div>
          {saved.estimate.config_version !== shownVersion ? (
            <Alert variant="warning" role="presentation" data-version-differs>
              <TriangleAlert aria-hidden />
              <AlertDescription>
                {format(text.differs, { saved: saved.estimate.config_version, shown: shownVersion })}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : (
        <>
          <Button type="button" onClick={onSave} aria-disabled={save.isPending} data-pending={save.isPending} className="w-fit">
            {text.button}
          </Button>
          <p className="type-small text-ink-2">{text.note}</p>
        </>
      )}
      {save.isError ? <ApiErrorMessage error={save.error} /> : null}
    </div>
  );
}
