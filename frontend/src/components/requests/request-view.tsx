"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { OffersSection } from "@/components/requests/offers-section";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import type { components } from "@/lib/api/schema";
import type { ApiError } from "@/lib/api/errors";
import { formatLongDate } from "@/lib/catalogue/detail";
import { useCompanyNames, useRequest, useWithdrawRequest } from "@/lib/requests/hooks";
import {
  deliveryStatusLabel,
  headline,
  requestStatusLabel,
  staleMessage,
  withdrawal,
} from "@/lib/requests/progress";
import { formatList } from "@/lib/landing/format";
import { format, messages } from "@/messages";

const text = messages.requests.detail;
const delivery = messages.requests.delivery;
const wd = messages.requests.withdraw;

type Request = components["schemas"]["CustomerRequestDetail"];

/** One request and each company's progress, with withdrawal when it is still possible. */
export function RequestView({ id }: { id: string }) {
  const query = useRequest(id);
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <Link href="/my/requests" className="inline-flex min-h-11 items-center text-sm underline underline-offset-2">
        {text.back}
      </Link>
      <QueryState query={query}>
        {(request) => <Detail request={request} refreshing={query.isRefetching} onRefresh={() => void query.refetch()} refetch={query.refetch} />}
      </QueryState>
    </div>
  );
}

function Detail({
  request,
  refreshing,
  onRefresh,
  refetch,
}: {
  request: Request;
  refreshing: boolean;
  onRefresh: () => void;
  refetch: () => Promise<{ data?: Request }>;
}) {
  const names = useCompanyNames(request.deliveries.map((entry) => entry.company_id));
  const withdraw = useWithdrawRequest(request.id);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const confirmRef = useRef<HTMLHeadingElement>(null);
  const statusRef = useRef<HTMLHeadingElement>(null);
  // Synchronous guard: React state is too slow to stop two clicks in the same moment.
  const inFlight = useRef(false);

  const state = withdrawal(request);
  const requirements = request.requirements as { district?: string; monthly_consumption_kwh?: string | null; details?: string };

  const open = () => {
    setNotice(null);
    setProblem(null);
    setConfirming(true);
    // Move focus to the question so keyboard and screen reader users meet it.
    setTimeout(() => confirmRef.current?.focus(), 0);
  };

  const confirm = () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setNotice(null);
    setProblem(null);
    withdraw.mutate(undefined, {
      onSuccess: () => {
        setConfirming(false);
        setDone(true);
        setTimeout(() => statusRef.current?.focus(), 0);
      },
      onError: (error) => {
        setConfirming(false);
        if (error.status === 409) {
          // Things moved on since this page was loaded: read the request again and say what changed.
          void refetch().then((fresh) => setNotice(staleMessage(fresh.data)));
        } else {
          setProblem(error);
        }
      },
      onSettled: () => {
        inFlight.current = false;
      },
    });
  };

  const responding = request.deliveries
    .filter((entry) => entry.status === "responding" || entry.status === "closed")
    .map((entry) => names.get(entry.company_id) ?? delivery.responding);

  return (
    <>
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <h2
          ref={statusRef}
          tabIndex={-1}
          className="text-lg font-medium outline-none"
          data-status
        >
          {requestStatusLabel(request.status)}
        </h2>
        <p className="text-sm text-muted-foreground">
          {format(text.sentOn, { date: formatLongDate(request.created_at) ?? request.created_at })}
        </p>
        <p role="status" className="text-sm" data-headline>
          {headline(request)}
        </p>
        {done ? (
          <p role="status" className="text-sm font-medium" data-done>
            {wd.done}
          </p>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={onRefresh} aria-disabled={refreshing}>
          {refreshing ? text.refreshing : text.refresh}
        </Button>
      </header>

      <section aria-labelledby="progress-title" className="space-y-3">
        <h2 id="progress-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.progressTitle}
        </h2>
        <table className="w-full text-sm" data-progress>
          <caption className="sr-only">{text.progressCaption}</caption>
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="py-2 pr-4 font-medium">
                {text.company}
              </th>
              <th scope="col" className="py-2 font-medium">
                {text.progress}
              </th>
            </tr>
          </thead>
          <tbody>
            {request.deliveries.map((entry) => {
              const name = names.get(entry.company_id);
              const when =
                entry.status === "viewed" || entry.status === "responding" || entry.status === "closed"
                  ? entry.viewed_at
                    ? format(delivery.openedOn, { date: formatLongDate(entry.viewed_at) ?? entry.viewed_at })
                    : null
                  : entry.status === "submitted"
                    ? format(delivery.sentOn, { date: formatLongDate(entry.created_at) ?? entry.created_at })
                    : null;
              return (
                <tr key={entry.id} className="border-b align-top last:border-0" data-delivery={entry.status}>
                  <th scope="row" className="py-2 pr-4 text-left font-normal">
                    {name === undefined ? (
                      <span className="text-muted-foreground">…</span>
                    ) : name === null ? (
                      <span className="text-muted-foreground">{text.notListed}</span>
                    ) : (
                      <Link href={`/companies/${entry.company_id}`} className="inline-flex min-h-11 items-center underline underline-offset-2">
                        {name}
                      </Link>
                    )}
                  </th>
                  <td className="py-2">
                    <span className="font-medium">{deliveryStatusLabel(entry.status)}</span>
                    {when ? <span className="block text-muted-foreground">{when}</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <OffersSection requestId={request.id} />

      <section aria-labelledby="asked-title" className="space-y-2">
        <h2 id="asked-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.askedTitle}
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{text.district}</dt>
          <dd>{requirements.district ?? ""}</dd>
          <dt className="text-muted-foreground">{text.consumption}</dt>
          <dd>
            {requirements.monthly_consumption_kwh
              ? format(text.consumptionValue, { value: requirements.monthly_consumption_kwh })
              : text.consumptionNone}
          </dd>
          <dt className="text-muted-foreground">{text.estimate}</dt>
          <dd>
            {request.saved_estimate_id ? (
              <Link href={`/my/estimates/${request.saved_estimate_id}`} className="inline-flex min-h-11 items-center underline underline-offset-2">
                {text.estimateView}
              </Link>
            ) : (
              text.estimateNone
            )}
          </dd>
          <dt className="text-muted-foreground">{text.details}</dt>
          <dd className="whitespace-pre-wrap">{requirements.details ?? ""}</dd>
        </dl>
      </section>

      <section aria-labelledby="actions-title" className="space-y-3">
        <h2 id="actions-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.actionsTitle}
        </h2>
        {notice ? (
          <p role="alert" className="text-sm font-medium" data-stale-notice>
            {notice}
          </p>
        ) : null}
        {problem ? <ApiErrorMessage error={problem} /> : null}
        {state.eligible ? (
          confirming ? (
            <div role="group" aria-labelledby="confirm-title" className="space-y-3 rounded-lg border p-4" data-confirm>
              <h3
                id="confirm-title"
                ref={confirmRef}
                tabIndex={-1}
                className="font-medium outline-none"
              >
                {wd.confirmTitle}
              </h3>
              <p className="text-sm">{wd.confirmBody}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={confirm} aria-disabled={withdraw.isPending} data-confirm-yes>
                  {withdraw.isPending ? wd.working : wd.confirm}
                </Button>
                <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
                  {wd.keep}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{wd.intro}</p>
              <Button type="button" variant="outline" onClick={open} data-withdraw>
                {wd.button}
              </Button>
            </>
          )
        ) : (
          <p className="text-sm text-muted-foreground" data-not-withdrawable>
            {state.reason === "responding"
              ? responding.length > 0
                ? format(wd.notPossible.responding, { names: formatList(responding) })
                : wd.notPossible.respondingUnknown
              : wd.notPossible[state.reason]}
          </p>
        )}
      </section>
    </>
  );
}
