"use client";

import Link from "next/link";

import { QueryState } from "@/components/query-state";
import { useCompanyNames } from "@/lib/requests/hooks";
import { type OfferSummary, useRequestOffers } from "@/lib/quotation/customer-hooks";
import { expiryText, isExpiringSoon, offerState, stateLabel } from "@/lib/quotation/customer";
import { formatMoney } from "@/lib/quotation/draft";
import { format, messages, plural } from "@/messages";

const text = messages.customerOffers;

/** The offers on a request: who sent them, their state and expiry, and the way into each one and the comparison. */
export function OffersSection({ requestId }: { requestId: string }) {
  const query = useRequestOffers(requestId);
  return (
    <section aria-labelledby="offers-title" className="space-y-3" data-offers-section>
      <h2 id="offers-title" className="font-heading text-xl font-semibold tracking-tight">
        {text.list.title}
      </h2>
      <p className="text-sm text-muted-foreground">{text.list.intro}</p>
      <QueryState query={query} isEmpty={(items) => items.length === 0} empty={<p className="text-sm text-muted-foreground" data-no-offers>{text.list.none}</p>}>
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
      <ul className="space-y-3" data-offers>
        {items.map((item) => {
          const name = names.get(item.company_id);
          const state = offerState(item, now);
          const soon = isExpiringSoon(item, now);
          return (
            <li key={item.quotation_id} className="space-y-1 rounded-lg border p-3 text-sm" data-offer={state}>
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {name === undefined ? "…" : format(text.list.company, { name: name ?? text.list.notListed })}
                </span>
                <span className="rounded-full border px-2 py-0.5 text-xs" data-state={state}>
                  {stateLabel(state)}
                </span>
              </p>
              <p>{format(text.list.total, { total: formatMoney(item.total) ?? text.detail.notSpecified })}</p>
              <p data-expiry>{expiryText(item, now)}</p>
              {soon ? (
                <p className="font-medium" data-soon>
                  {text.expiry.soon}
                </p>
              ) : null}
              <p className="text-muted-foreground">{format(plural(text.list.revisions, item.sent_revision_count), { count: item.sent_revision_count })}</p>
              <Link href={`/my/requests/${requestId}/offers/${item.quotation_id}`} className="underline underline-offset-2">
                {text.list.view}
              </Link>
            </li>
          );
        })}
      </ul>
      {open.length >= 2 ? (
        <Link href={`/my/requests/${requestId}/compare`} className="inline-block text-sm font-medium underline underline-offset-2" data-compare-link>
          {text.list.compare}
        </Link>
      ) : (
        <p className="text-sm text-muted-foreground" data-compare-need>
          {text.list.compareNeedTwo}
        </p>
      )}
    </>
  );
}
