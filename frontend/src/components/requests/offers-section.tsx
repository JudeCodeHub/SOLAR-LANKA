"use client";

import { Clock } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { QueryState } from "@/components/query-state";
import { useCompanyNames } from "@/lib/requests/hooks";
import { type OfferSummary, useRequestOffers } from "@/lib/quotation/customer-hooks";
import { cn } from "@/lib/utils";
import { expiryText, isExpiringSoon, offerState, stateLabel, stateTone } from "@/lib/quotation/customer";
import { formatMoney } from "@/lib/quotation/draft";
import { format, messages, plural } from "@/messages";

const text = messages.customerOffers;

/** The offers on a request: who sent them, their state and expiry, and the way into each one and the comparison. */
export function OffersSection({ requestId }: { requestId: string }) {
  const query = useRequestOffers(requestId);
  return (
    <section aria-labelledby="offers-title" className="space-y-4" data-offers-section>
      <h2 id="offers-title" className="type-heading text-ink">
        {text.list.title}
      </h2>
      <p className="type-body max-w-reading text-ink-2">{text.list.intro}</p>
      <QueryState query={query} isEmpty={(items) => items.length === 0} empty={<p className="type-body rounded-card border border-line bg-surface p-4 text-ink-2" data-no-offers>{text.list.none}</p>}>
        {(items) => <Offers requestId={requestId} items={items} now={query.dataUpdatedAt} />}
      </QueryState>
    </section>
  );
}

function Offers({ requestId, items, now }: { requestId: string; items: OfferSummary[]; now: number }) {
  const names = useCompanyNames(items.map((item) => item.company_id));
  const open = items.filter((item) => offerState(item, now) === "active");
  return (
    <>
      <ul className="grid gap-4 md:grid-cols-2" data-offers>
        {items.map((item) => (
          <li key={item.quotation_id}>
            <OfferCard requestId={requestId} item={item} name={names.get(item.company_id)} now={now} />
          </li>
        ))}
      </ul>
      {open.length >= 2 ? (
        <Link href={`/my/requests/${requestId}/compare`} className={buttonVariants()} data-compare-link>
          {text.list.compare}
        </Link>
      ) : (
        <p className="type-small text-ink-2" data-compare-need>
          {text.list.compareNeedTwo}
        </p>
      )}
    </>
  );
}

/** One offer: the company, its state as a chip, the total, when it ends and the way in. `name` is undefined while loading and null for a company no longer listed. */
export function OfferCard({ requestId, item, name, now }: { requestId: string; item: OfferSummary; name: string | null | undefined; now: number }) {
  const state = offerState(item, now);
  const soon = isExpiringSoon(item, now);
  return (
    <article className="flex h-full flex-col gap-2 rounded-card border border-line bg-surface p-5 text-sm shadow-e1" data-offer={state}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-subheading text-ink">{name === undefined ? "…" : format(text.list.company, { name: name ?? text.list.notListed })}</p>
        <Badge variant={stateTone(state)} data-state={state}>
          {stateLabel(state)}
        </Badge>
      </div>
      <p className="type-figure text-xl font-semibold text-ink" data-total>
        {format(text.list.total, { total: formatMoney(item.total) ?? text.detail.notSpecified })}
      </p>
      <p className="text-ink" data-expiry>{expiryText(item, now)}</p>
      {soon ? (
        <p className="flex items-center gap-2 font-medium text-warning" data-soon>
          <Clock aria-hidden className="size-4 shrink-0" />
          {text.expiry.soon}
        </p>
      ) : null}
      <p className="text-ink-2">{format(plural(text.list.revisions, item.sent_revision_count), { count: item.sent_revision_count })}</p>
      <Link href={`/my/requests/${requestId}/offers/${item.quotation_id}`} className={cn(buttonVariants({ variant: "secondary" }), "mt-auto w-fit")}>
        {text.list.view}
      </Link>
    </article>
  );
}
