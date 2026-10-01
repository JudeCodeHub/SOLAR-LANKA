"use client";

import { NextSteps, SummaryCard } from "@/components/dashboard/dashboard-parts";
import { QueryState } from "@/components/query-state";
import { customerActions } from "@/lib/dashboard/dashboard";
import { OFFER_REQUESTS, useDashboardRequests, useOffersFor } from "@/lib/dashboard/hooks";
import { progressText } from "@/lib/installations/progress";
import { useUnreadCount } from "@/lib/notifications/hooks";
import { expiryText, isExpiringSoon, offerState } from "@/lib/quotation/customer";
import { useInstallations } from "@/lib/quotation/customer-hooks";
import { format, messages, plural } from "@/messages";
import Link from "next/link";

const text = messages.dashboard.customer;

/** The customer's home: requests, open offers, installations and what to do next. */
export function CustomerDashboard() {
  const requests = useDashboardRequests();
  const installations = useInstallations(1);
  const unread = useUnreadCount();

  const active = (requests.data?.items ?? []).filter((request) => request.status === "submitted");
  const asked = active.slice(0, OFFER_REQUESTS);
  const offers = useOffersFor(asked.map((request) => request.id));
  const now = Math.max(0, ...offers.map((query) => query.dataUpdatedAt));
  const offersLoaded = requests.isSuccess && offers.every((query) => query.isSuccess);

  const open = offers.flatMap((query, index) =>
    (query.data ?? []).filter((offer) => offerState(offer, now) === "active").map((offer) => ({ offer, requestId: asked[index]?.id ?? "" })),
  );
  const soon = open.filter(({ offer }) => isExpiringSoon(offer, now));
  const urgent = [...soon].sort((a, b) => Date.parse(a.offer.valid_until ?? "") - Date.parse(b.offer.valid_until ?? ""))[0];
  const inProgress = installations.data ? installations.data.items.filter((item) => item.completed_milestones < item.total_milestones).length : undefined;

  const actions = customerActions({
    totalRequests: requests.data?.total,
    activeRequests: requests.isSuccess ? active.length : undefined,
    openOffers: offersLoaded ? open.length : undefined,
    expiringSoon: offersLoaded ? soon.length : undefined,
    urgentRequestId: urgent?.requestId ?? null,
    installationsInProgress: inProgress,
    unread: unread.data,
  });
  const partial = requests.isError || installations.isError || unread.isError || offers.some((query) => query.isError);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      <NextSteps actions={actions} partial={partial} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard id="requests" title={text.requestsTitle} link={{ href: "/my/requests", label: text.viewRequests }}>
          <QueryState query={requests} isEmpty={(result) => result.total === 0} empty={<p data-empty>{text.requestsNone}</p>}>
            {(result) => <p>{format(plural(text.requestsLine, result.total), { active: active.length, count: result.total })}</p>}
          </QueryState>
        </SummaryCard>
        <SummaryCard id="offers" title={text.offersTitle}>
          {!offersLoaded ? null : open.length === 0 ? (
            <p data-empty>{text.offersNone}</p>
          ) : (
            <>
              <p>{format(plural(text.offersLine, open.length), { count: open.length })}</p>
              {soon.length > 0 ? <p className="font-medium">{format(plural(text.soonLine, soon.length), { count: soon.length })}</p> : null}
              <ul className="space-y-1">
                {open.slice(0, 3).map(({ offer, requestId }) => (
                  <li key={offer.quotation_id}>
                    <Link href={`/my/requests/${requestId}/offers/${offer.quotation_id}`} className="inline-flex min-h-11 items-center underline underline-offset-2">
                      {expiryText(offer, now)}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {active.length > OFFER_REQUESTS ? <p className="text-muted-foreground">{format(text.offersLimit, { count: OFFER_REQUESTS })}</p> : null}
        </SummaryCard>
        <SummaryCard id="installations" title={text.installationsTitle} link={{ href: "/my/installations", label: text.viewInstallations }}>
          <QueryState query={installations} isEmpty={(result) => result.total === 0} empty={<p data-empty>{text.installationsNone}</p>}>
            {(result) => (
              <ul className="space-y-1">
                {result.items.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <Link href={`/my/installations/${item.id}`} className="inline-flex min-h-11 items-center underline underline-offset-2">
                      {progressText(item.completed_milestones, item.total_milestones)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </SummaryCard>
      </div>
    </div>
  );
}
