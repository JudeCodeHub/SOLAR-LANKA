"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { COMPANY_LIMIT, useEligibleCompanies, useSubmitRequest } from "@/lib/requests/hooks";
import { useRequestDraft } from "@/lib/requests/draft-store";
import {
  buildRequestBody,
  fingerprintOf,
  MAX_RECIPIENTS,
  mayHaveBeenReceived,
  resolveRecipients,
} from "@/lib/requests/recipients";
import type { Requirements } from "@/lib/requests/requirements";
import { formatList, serviceLabel } from "@/lib/landing/format";
import { format, messages, plural } from "@/messages";

const rec = messages.requestPrep.recipients;
const review = messages.requestPrep.review;

/** Choosing who receives the request, and sending it. */
export function RecipientsStep({ requirements }: { requirements: Requirements }) {
  const companies = useEligibleCompanies(requirements.district);
  const recipients = useRequestDraft((state) => state.recipients);
  const toggle = useRequestDraft((state) => state.toggle);
  const removeRecipient = useRequestDraft((state) => state.removeRecipient);
  const keyFor = useRequestDraft((state) => state.keyFor);
  const markSent = useRequestDraft((state) => state.markSent);
  const submit = useSubmitRequest();
  const [announcement, setAnnouncement] = useState("");
  // Synchronous guard: React state is too slow to stop several clicks in the same moment.
  const inFlight = useRef(false);

  const items = companies.data?.items ?? [];
  const { listed, missing } = resolveRecipients(recipients, items);
  const loaded = companies.isSuccess;
  const count = recipients.length;
  const counts = { count, max: MAX_RECIPIENTS };

  const choose = (id: string, name: string) => {
    const outcome = toggle(id);
    const after = useRequestDraft.getState().recipients.length;
    setAnnouncement(
      outcome === "full"
        ? format(rec.full, { max: MAX_RECIPIENTS })
        : format(outcome === "added" ? rec.added : rec.removed, { name, count: after, max: MAX_RECIPIENTS }),
    );
  };

  const send = () => {
    if (inFlight.current || !loaded || missing.length > 0 || listed.length === 0) return;
    inFlight.current = true;
    const ids = listed.map((company) => company.id);
    const key = keyFor(fingerprintOf(requirements, ids));
    const names = new Map(listed.map((company) => [company.id, company.name]));
    submit.mutate(
      { body: buildRequestBody(requirements, ids), key },
      {
        onSuccess: ({ created, replayed }) =>
          markSent({
            id: created.id,
            replayed,
            companies: created.deliveries.map((delivery) => ({
              id: delivery.company_id,
              name: names.get(delivery.company_id) ?? delivery.company_id,
              status: delivery.status,
            })),
          }),
        // The companies' eligibility may have changed: show the current list.
        onError: (error) => {
          if (error.status === 422) void companies.refetch();
        },
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
  };

  return (
    <>
      <section aria-labelledby="recipients-title" className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" data-section="recipients">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="recipients-title" className="type-subheading flex items-center gap-3 text-ink">
            <span aria-hidden className="grid size-8 place-items-center rounded-full bg-orange-tint text-orange-text type-figure">{3}</span>
            {rec.title}
          </h2>
          <p role="status" className="inline-flex min-h-8 items-center rounded-full border border-orange-text/30 bg-orange-tint px-3.5 text-sm font-medium text-orange-text" data-count>
            {announcement || format(rec.count, counts)}
          </p>
        </div>
        <p className="type-small text-ink-2">{format(rec.intro, { district: requirements.district })}</p>
        {companies.isPending ? (
          <p role="status" className="type-small text-ink-2">
            {rec.loading}
          </p>
        ) : companies.isError ? (
          <ApiErrorMessage error={companies.error} onRetry={() => void companies.refetch()} retrying={companies.isRefetching} />
        ) : items.length === 0 ? (
          <EmptyState
            title={format(rec.none, { district: requirements.district })}
            description={rec.noneHelp}
            action={
              <Button asChild>
                <Link href="/companies">{messages.requestPrep.sent.browse}</Link>
              </Button>
            }
          />
        ) : (
          <>
            {companies.data.total > COMPANY_LIMIT ? (
              <p className="type-small text-ink-2">
                {format(rec.more, { shown: items.length, total: companies.data.total })}
              </p>
            ) : null}
            <ul className="grid gap-3 md:grid-cols-2" data-companies>
              {items.map((company) => {
                const chosen = recipients.includes(company.id);
                const blocked = !chosen && count >= MAX_RECIPIENTS;
                return (
                  <li key={company.id} className="rounded-card border border-line bg-paper p-4 has-[:checked]:border-orange-text has-[:checked]:bg-orange-tint" data-company={company.id}>
                    <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="field-check mt-1 size-6 shrink-0"
                        checked={chosen}
                        aria-disabled={blocked}
                        aria-label={format(rec.choose, { name: company.name })}
                        onChange={() => choose(company.id, company.name)}
                      />
                      <span className="space-y-1">
                        <span className="type-subheading block text-ink">{company.name}</span>
                        <span className="block text-ink-2">
                          {rec.services}: {formatList(company.services.map(serviceLabel))}
                        </span>
                        {company.declared_credentials.length > 0 ? (
                          <span className="block text-ink-2">
                            {rec.credentials}:{" "}
                            {company.declared_credentials
                              .map((credential) => format(rec.credentialLine, { name: credential.name, issuer: credential.issuer }))
                              .join("; ")}
                          </span>
                        ) : null}
                      </span>
                    </label>
                    <p className="pl-9 text-sm">
                      <Link href={`/companies/${company.id}`} className="inline-flex min-h-11 items-center font-medium text-orange-text underline underline-offset-2">
                        {rec.profile}
                      </Link>
                    </p>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="review-title" className="space-y-4 rounded-card border-2 border-orange-text bg-surface p-5 shadow-e2 sm:p-6" data-section="review">
        <h2 id="review-title" className="type-heading text-ink">
          {review.title}
        </h2>
        {count === 0 ? (
          <p className="type-body text-ink-2" data-no-recipients>
            {review.none}
          </p>
        ) : (
          <>
            <p className="type-body font-medium text-ink">
              {count === 1 ? review.lead_one : format(review.lead, { count })}
            </p>
            <ul className="flex flex-wrap gap-2 text-sm" data-recipients>
              {recipients.map((id) => {
                const company = listed.find((entry) => entry.id === id);
                const name = company?.name ?? review.unavailableName;
                return (
                  <li key={id} className="flex items-center gap-1 rounded-full border border-line bg-paper-2 py-0.5 pr-1 pl-4">
                    <span className={company ? "font-medium text-ink" : "font-medium text-danger"}>
                      {name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={format(review.remove, { name })}
                      onClick={() => removeRecipient(id)}
                    >
                      {review.removeShort}
                    </Button>
                  </li>
                );
              })}
            </ul>
            {loaded && missing.length > 0 ? (
              <p role="alert" className="text-sm font-medium text-danger" data-missing>
                {format(review.unavailable, { count: missing.length })}
              </p>
            ) : null}
            <p className="type-small text-ink-2">{review.sees}</p>
            <p className="type-small text-ink-2">{review.safe}</p>
            <Button
              type="button"
              onClick={send}
              size="lg"
              aria-disabled={submit.isPending || !loaded || missing.length > 0}
              data-pending={submit.isPending}
              data-send
            >
              {submit.isPending ? review.sending : format(plural(review.send, count), { count })}
            </Button>
            {submit.isError ? (
              <div className="space-y-2">
                <ApiErrorMessage error={submit.error} />
                {mayHaveBeenReceived(submit.error.status) ? (
                  <p className="text-sm font-medium text-ink" data-uncertain>
                    {review.uncertain}
                  </p>
                ) : null}
                {submit.error.status === 422 ? (
                  <p className="text-sm font-medium" data-changed>
                    {review.changed}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}
