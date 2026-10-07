"use client";

import { BackLink } from "@/components/ui/back-link";
import { BadgeHelp, CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { PlatformGate } from "@/components/admin/platform-gate";
import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { QueryState } from "@/components/query-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
          <header className="space-y-3 rounded-panel border border-line bg-surface p-6 shadow-e1" data-review-header>
            <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{text.eyebrow}</p>
            <h1 className="type-display-m text-ink">{format(text.title, { name: data.name })}</h1>
            <p className="flex flex-wrap items-center gap-2 text-ink" data-status>
              <Badge variant={data.publication_status === "approved" ? "success" : data.publication_status === "pending" ? "info" : data.publication_status === "rejected" ? "danger" : "neutral"}>
                {format(text.status, { status: statusLabel(data.publication_status) })}
              </Badge>
            </p>
          </header>
          {done ? (
            <Alert ref={doneRef as never} variant="success" tabIndex={-1} role="status" className="outline-none" data-done>
              <CircleCheck aria-hidden />
              <AlertDescription>{done}</AlertDescription>
            </Alert>
          ) : null}
          {refused ? (
            <Alert variant="warning" role="alert" data-refused>
              <TriangleAlert aria-hidden />
              <AlertDescription>{refusalText(data)}</AlertDescription>
            </Alert>
          ) : null}
          {error ? <ApiErrorMessage error={error} /> : null}

          <section aria-labelledby="profile-title" className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6">
            <h2 id="profile-title" className="type-heading text-ink">
              {text.profile}
            </h2>
            <dl className="description-list text-sm">
              <dt className="text-ink-2">{text.districts}</dt>
              <dd>{data.service_districts.join(", ") || text.none}</dd>
              <dt className="text-ink-2">{text.services}</dt>
              <dd>{data.services.join(", ") || text.none}</dd>
              <dt className="text-ink-2">{text.credentials}</dt>
              <dd>
                {data.declared_credentials.length === 0 ? (
                  text.none
                ) : (
                  <ul className="space-y-2">
                    {data.declared_credentials.map((credential) => (
                      <li key={`${credential.name}-${credential.issuer}`} className="space-y-1.5 rounded-field border border-dashed border-field-border bg-paper-2 p-3">
                        <span className="block text-ink">{format(text.credentialLine, { name: credential.name, issuer: credential.issuer })}</span>
                        <Badge variant="warning" icon={BadgeHelp} data-declared-badge>
                          {messages.directory.credentials.badge}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </dl>
            <p className="type-small text-ink-2">{text.credentialsHelp}</p>
          </section>

          <section aria-labelledby="decision-title" className="space-y-4 rounded-card border-2 border-orange-text bg-surface p-5 shadow-e2 sm:p-6" data-decision>
            <h2 id="decision-title" className="type-heading text-ink">
              {text.decisionTitle}
            </h2>
            {canDecide(data.publication_status) ? (
              <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
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
              <p className="type-body text-ink" data-not-pending>
                {format(text.notPending, { status: statusLabel(data.publication_status) })}
              </p>
            )}
          </section>

          <section aria-labelledby="history-title" className="space-y-3">
            <h2 id="history-title" className="type-heading text-ink">
              {text.history}
            </h2>
            <QueryState query={reviews} isEmpty={(items) => items.length === 0} empty={<p className="type-body text-ink-2">{text.historyNone}</p>}>
              {(items) => (
                <ul className="space-y-3" data-history>
                  {items.map((entry) => (
                    <li key={entry.id} className="space-y-1 rounded-card border border-line bg-surface p-4 text-sm shadow-e1" data-outcome={entry.outcome}>
                      <p className="font-medium text-ink">{outcomeLabel(entry.outcome)}</p>
                      <p className="text-ink-2">{formatLongDate(entry.created_at) ?? entry.created_at}</p>
                      <p className="text-ink">{format(text.by, { id: shortId(entry.actor_id) })}</p>
                      <Link href={`/admin/users?user=${entry.actor_id}`} className="inline-flex min-h-11 items-center font-medium text-orange-text underline underline-offset-2">
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
