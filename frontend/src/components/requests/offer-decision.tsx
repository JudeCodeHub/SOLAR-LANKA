"use client";

import { CircleX, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmAction } from "@/components/company/confirm-action";
import type { ApiError } from "@/lib/api/errors";
import { formatLongDate } from "@/lib/catalogue/detail";
import { offerState } from "@/lib/quotation/customer";
import { type SentRevision, useDecision, useRequestOffers } from "@/lib/quotation/customer-hooks";
import { blockerText, decisionBlocker } from "@/lib/quotation/decision";
import { formatMoney } from "@/lib/quotation/draft";
import { useRequest } from "@/lib/requests/hooks";
import { format, messages } from "@/messages";

const text = messages.customerOffers.decide;

/** Accept or decline exactly the revision on screen, asking first and explaining any refusal from the fresh state. */
export function OfferDecision({
  requestId,
  quotationId,
  revision,
  companyName,
  now,
  refusedFor,
  setRefusedFor,
}: {
  requestId: string;
  quotationId: string;
  revision: SentRevision;
  companyName: string;
  now: number;
  /** The revision a refused attempt was about; held by the parent because a newer revision remounts this component. */
  refusedFor: string | null;
  setRefusedFor: (revisionId: string | null) => void;
}) {
  const router = useRouter();
  const request = useRequest(requestId);
  const offers = useRequestOffers(requestId);
  const { accept, decline } = useDecision(requestId, quotationId, revision.id);
  const busy = useRef(false);
  const refused = refusedFor !== null;
  const [error, setError] = useState<ApiError | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  const fresh = Math.max(now, offers.dataUpdatedAt);
  const ready = request.data && offers.data;
  const check = (revisionId: string) =>
    ready ? decisionBlocker({ requestStatus: request.data.status, offers: offers.data, quotationId, revisionId, now: fresh }) : null;
  // What can be done now is about the revision on screen; a refusal is explained for the revision that was attempted.
  const blocker = check(revision.id);
  const refusal = check(refusedFor ?? revision.id);
  const state = offerState(revision, fresh);
  const declined = state === "declined";
  const open = state === "active" && blocker === null;

  const run = (kind: "accept" | "decline") => {
    // A synchronous guard: state updates are too slow to stop a rapid second click.
    if (busy.current) return;
    busy.current = true;
    setRefusedFor(null);
    setError(null);
    const fail = (failure: ApiError) => {
      busy.current = false;
      if ((failure.status === 409 || failure.status === 404)) setRefusedFor(revision.id);
      else setError(failure);
    };
    if (kind === "accept") {
      accept.mutate(undefined, {
        onSuccess: (installation) => router.push(`/my/installations/${installation.installation_id}?accepted=1`),
        onError: fail,
      });
    } else {
      decline.mutate(undefined, {
        onSuccess: () => {
          busy.current = false;
          setTimeout(() => statusRef.current?.focus(), 0);
        },
        onError: fail,
      });
    }
  };

  const total = formatMoney(revision.total) ?? messages.customerOffers.detail.notSpecified;
  const date = revision.valid_until ? (formatLongDate(revision.valid_until) ?? revision.valid_until) : "";
  const vars = { number: revision.revision_number, name: companyName, total, date };

  return (
    <section aria-labelledby="decide-title" className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" data-decision>
      <h2 id="decide-title" className="type-heading text-ink">
        {text.title}
      </h2>
      {declined ? (
        <p ref={statusRef} tabIndex={-1} role="status" className="flex items-center gap-2 text-base font-medium text-ink outline-none" data-declined>
          <CircleX aria-hidden className="size-5 shrink-0 text-ink-2" />
          {text.declined}
        </p>
      ) : null}
      {refused ? (
        <Alert variant="warning" role="alert" data-refused>
          <TriangleAlert aria-hidden />
          <AlertDescription>
            {blockerText(refusal)} {text.noteStale}
          </AlertDescription>
        </Alert>
      ) : null}
      {error ? <ApiErrorMessage error={error} /> : null}
      {open ? (
        <>
          <p className="type-body text-ink-2">{text.intro}</p>
          <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
            <ConfirmAction
              id="accept"
              variant="default"
              label={accept.isPending ? text.working : text.accept}
              help={text.acceptHelp}
              title={format(text.acceptTitle, vars)}
              body={format(text.acceptBody, vars)}
              yes={text.acceptYes}
              keep={text.keep}
              disabled={accept.isPending || decline.isPending}
              onConfirm={() => run("accept")}
            />
            <ConfirmAction
              id="decline"
              label={decline.isPending ? text.working : text.decline}
              help={text.declineHelp}
              title={format(text.declineTitle, vars)}
              body={format(text.declineBody, vars)}
              yes={text.declineYes}
              keep={text.keep}
              disabled={accept.isPending || decline.isPending}
              onConfirm={() => run("decline")}
            />
          </div>
        </>
      ) : !declined && !refused ? (
        <p className="type-body text-ink" data-not-open>
          {blocker ? blockerText(blocker) : text.notOpen}
        </p>
      ) : null}
    </section>
  );
}
