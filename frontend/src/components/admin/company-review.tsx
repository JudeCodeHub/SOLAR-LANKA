"use client";

import { BackLink } from "@/components/ui/back-link";
import Link from "next/link";
import { useRef, useState } from "react";

import { PlatformGate } from "@/components/admin/platform-gate";
import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { QueryState } from "@/components/query-state";
import type { ApiError } from "@/lib/api/errors";
import { formatLongDate } from "@/lib/catalogue/detail";
import { useAdminCompany, useAdminReviews, useDecide } from "@/lib/admin/hooks";
import { canDecide, outcomeLabel, refusalText, shortId, statusLabel } from "@/lib/admin/review";
import { format, messages } from "@/messages";

const text = messages.admin.detail;

/** One company's submitted profile and review history, with the platform's decision. */
export function CompanyReview({ id }: { id: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <BackLink href="/admin/companies">{text.back}</BackLink>
      <PlatformGate>{() => <Review id={id} />}</PlatformGate>
    </div>
  );
}

function Review({ id }: { id: string }) {
  const company = useAdminCompany(id);
  const reviews = useAdminReviews(id);
  const decide = useDecide(id);
  const busy = useRef(false);
  const [refused, setRefused] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);

  const run = (outcome: "approved" | "rejected") => {
    // A synchronous guard: state updates are too slow to stop a rapid second click.
    if (busy.current) return;
    busy.current = true;
    setRefused(false);
    setError(null);
    setDone(null);
    decide.mutate(outcome, {
      onSuccess: (entry) => {
        busy.current = false;
        setDone(format(text.decided, { name: company.data?.name ?? "", status: statusLabel(entry.outcome) }));
        setTimeout(() => doneRef.current?.focus(), 0);
      },
      onError: (failure) => {
        busy.current = false;
        if (failure.status === 409 || failure.status === 404) setRefused(true);
        else setError(failure);
      },
    });
  };

  return (
    <QueryState query={company}>
      {(data) => (
        <>
          <header className="space-y-2">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">{format(text.title, { name: data.name })}</h1>
            <p className="text-sm font-medium" data-status>
              {format(text.status, { status: statusLabel(data.publication_status) })}
            </p>
          </header>
          {done ? (
            <p ref={doneRef} tabIndex={-1} role="status" className="text-sm font-medium outline-none" data-done>
              {done}
            </p>
          ) : null}
          {refused ? (
            <p role="alert" className="text-sm font-medium" data-refused>
              {refusalText(data)}
            </p>
          ) : null}
          {error ? <ApiErrorMessage error={error} /> : null}

          <section aria-labelledby="profile-title" className="space-y-3">
            <h2 id="profile-title" className="font-heading text-xl font-semibold tracking-tight">
              {text.profile}
            </h2>
            <dl className="description-list text-sm">
              <dt className="text-muted-foreground">{text.districts}</dt>
              <dd>{data.service_districts.join(", ") || text.none}</dd>
              <dt className="text-muted-foreground">{text.services}</dt>
              <dd>{data.services.join(", ") || text.none}</dd>
              <dt className="text-muted-foreground">{text.credentials}</dt>
              <dd>
                {data.declared_credentials.length === 0 ? (
                  text.none
                ) : (
                  <ul className="space-y-1">
                    {data.declared_credentials.map((credential) => (
                      <li key={`${credential.name}-${credential.issuer}`}>{format(text.credentialLine, { name: credential.name, issuer: credential.issuer })}</li>
                    ))}
                  </ul>
                )}
              </dd>
            </dl>
            <p className="text-sm text-muted-foreground">{text.credentialsHelp}</p>
          </section>

          <section aria-labelledby="decision-title" className="space-y-3" data-decision>
            <h2 id="decision-title" className="font-heading text-xl font-semibold tracking-tight">
              {text.decisionTitle}
            </h2>
            {canDecide(data.publication_status) ? (
              <div className="flex flex-wrap items-start gap-3">
                <ConfirmAction
                  id="approve"
                  variant="default"
                  label={decide.isPending ? text.working : text.approve}
                  help={text.approveHelp}
                  title={format(text.approveTitle, { name: data.name })}
                  body={text.approveBody}
                  yes={text.approveYes}
                  keep={text.keep}
                  disabled={decide.isPending}
                  onConfirm={() => run("approved")}
                />
                <ConfirmAction
                  id="reject"
                  label={decide.isPending ? text.working : text.reject}
                  help={text.rejectHelp}
                  title={format(text.rejectTitle, { name: data.name })}
                  body={text.rejectBody}
                  yes={text.rejectYes}
                  keep={text.keep}
                  disabled={decide.isPending}
                  onConfirm={() => run("rejected")}
                />
              </div>
            ) : (
              <p className="text-sm" data-not-pending>
                {format(text.notPending, { status: statusLabel(data.publication_status) })}
              </p>
            )}
          </section>

          <section aria-labelledby="history-title" className="space-y-2">
            <h2 id="history-title" className="font-heading text-xl font-semibold tracking-tight">
              {text.history}
            </h2>
            <QueryState query={reviews} isEmpty={(items) => items.length === 0} empty={<p className="text-sm text-muted-foreground">{text.historyNone}</p>}>
              {(items) => (
                <ul className="space-y-2" data-history>
                  {items.map((entry) => (
                    <li key={entry.id} className="rounded-lg border p-3 text-sm" data-outcome={entry.outcome}>
                      <p className="font-medium">{outcomeLabel(entry.outcome)}</p>
                      <p className="text-muted-foreground">{formatLongDate(entry.created_at) ?? entry.created_at}</p>
                      <p>{format(text.by, { id: shortId(entry.actor_id) })}</p>
                      <Link href={`/admin/users?user=${entry.actor_id}`} className="inline-flex min-h-11 items-center underline underline-offset-2">
                        {text.manage}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </QueryState>
          </section>
        </>
      )}
    </QueryState>
  );
}
