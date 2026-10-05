"use client";

import { BackLink } from "@/components/ui/back-link";
import { Table as DataTable, TableRegion } from "@/components/ui/table";
import Link from "next/link";

import { QueryState } from "@/components/query-state";
import { type Cell, cellText, compareRows, type ComparisonOfferLike, expiryText, offerState, stateLabel } from "@/lib/quotation/customer";
import { useComparison, useRequestOffers } from "@/lib/quotation/customer-hooks";
import { useCompanyNames } from "@/lib/requests/hooks";
import { format, messages } from "@/messages";

const text = messages.customerOffers.compare;

function CellView({ cell }: { cell: Cell }) {
  if (cell.kind === "value") return <span className="whitespace-pre-wrap">{cell.text}</span>;
  const label = cellText(cell);
  if (cell.kind === "unspecified") {
    return (
      <span className="rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground" data-cell="unspecified">
        {label}
      </span>
    );
  }
  return (
    <span className="rounded-full border px-2 py-0.5 text-xs" data-cell={cell.kind}>
      {label}
    </span>
  );
}

/** The open offers side by side: what differs, what is not specified, and when each one ends. */
export function CompareView({ requestId }: { requestId: string }) {
  const comparison = useComparison(requestId);
  const offers = useRequestOffers(requestId);
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
      <BackLink href={`/my/requests/${requestId}`}>{text.back}</BackLink>
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      <QueryState query={comparison}>
        {(data) => <Table requestId={requestId} offers={data.offers as unknown as ComparisonOfferLike[]} note={data.comparison_note} now={comparison.dataUpdatedAt} />}
      </QueryState>
      {offers.data ? <NotCompared requestId={requestId} items={offers.data} now={offers.dataUpdatedAt} /> : null}
    </div>
  );
}

function Table({ requestId, offers, note, now }: { requestId: string; offers: ComparisonOfferLike[]; note: string; now: number }) {
  const names = useCompanyNames(offers.map((offer) => offer.company_id));
  if (offers.length === 0) {
    return (
      <p className="text-sm" data-none>
        {text.none}
      </p>
    );
  }
  const rows = compareRows(offers, now);
  return (
    <section aria-label={text.caption} className="space-y-3">
      <p className="text-sm font-medium" data-note>
        {note}
      </p>
      {offers.length === 1 ? (
        <p className="text-sm" data-one>
          {text.oneOnly}
        </p>
      ) : null}
      <TableRegion label={text.region}>
        <DataTable style={{ minWidth: `${12 + offers.length * 12}rem` }} data-compare>
          <caption className="sr-only">{text.caption}</caption>
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="p-3 font-medium">
                {text.item}
              </th>
              {offers.map((offer) => {
                const name = names.get(offer.company_id);
                return (
                  <th key={offer.quotation_id} scope="col" className="p-3 font-medium" data-offer-column={offer.quotation_id}>
                    <Link href={`/my/requests/${requestId}/offers/${offer.quotation_id}`} className="inline-flex min-h-11 items-center underline underline-offset-2">
                      {name === undefined ? "…" : (name ?? messages.customerOffers.list.notListed)}
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b align-top last:border-0" data-row={row.id} data-differs={row.differs} data-some-unspecified={row.someUnspecified}>
                <th scope="row" className="p-3 text-left font-normal">
                  <span className="block">{row.label}</span>
                  {offers.length > 1 && row.differs ? <span className="mt-1 block text-xs font-medium" data-flag="differs">{text.differs}</span> : null}
                  {offers.length > 1 && row.someUnspecified ? <span className="mt-1 block text-xs text-muted-foreground" data-flag="unspecified">{text.someUnspecified}</span> : null}
                </th>
                {row.cells.map((cell, index) => (
                  <td key={offers[index]?.quotation_id ?? index} className="p-3">
                    <CellView cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TableRegion>
    </section>
  );
}

function NotCompared({ requestId, items, now }: { requestId: string; items: { quotation_id: string; company_id: string; status: string; valid_until: string | null }[]; now: number }) {
  const closed = items.filter((item) => offerState(item, now) !== "active");
  const names = useCompanyNames(closed.map((item) => item.company_id));
  if (closed.length === 0) return null;
  return (
    <section aria-labelledby="not-compared-title" className="space-y-2" data-not-compared>
      <h2 id="not-compared-title" className="font-heading text-xl font-semibold tracking-tight">
        {text.excludedTitle}
      </h2>
      <p className="text-sm text-muted-foreground">{text.excludedIntro}</p>
      <ul className="space-y-1 text-sm">
        {closed.map((item) => {
          const name = names.get(item.company_id) ?? messages.customerOffers.list.notListed;
          return (
            <li key={item.quotation_id}>
              <Link href={`/my/requests/${requestId}/offers/${item.quotation_id}`} className="underline underline-offset-2">
                {format(text.view, { name })}
              </Link>
              {format(text.excludedLine, { state: stateLabel(offerState(item, now)), expiry: expiryText(item, now) })}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
