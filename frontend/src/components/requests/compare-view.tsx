"use client";

import { BackLink } from "@/components/ui/back-link";
import { Table as DataTable, TableRegion } from "@/components/ui/table";
import { Info } from "lucide-react";
import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { DIFFERS_EDGE, DifferenceFlag, NotSpecified, UnspecifiedFlag } from "@/components/ui/compare-marks";
import { QueryState } from "@/components/query-state";
import { type Cell, cellText, compareRows, type ComparisonOfferLike, expiryText, offerState, stateLabel } from "@/lib/quotation/customer";
import { useComparison, useRequestOffers } from "@/lib/quotation/customer-hooks";
import { useCompanyNames } from "@/lib/requests/hooks";
import { format, messages } from "@/messages";

const text = messages.customerOffers.compare;

function CellView({ cell }: { cell: Cell }) {
  if (cell.kind === "value") return <span className="whitespace-pre-wrap">{cell.text}</span>;
  if (cell.kind === "unspecified") return <NotSpecified />;
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-medium text-ink" data-cell={cell.kind}>
      {cellText(cell)}
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
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      <QueryState query={comparison}>
        {(data) => <Table requestId={requestId} offers={data.offers as unknown as ComparisonOfferLike[]} note={data.comparison_note} now={comparison.dataUpdatedAt} />}
      </QueryState>
      {offers.data ? <NotCompared requestId={requestId} items={offers.data} now={offers.dataUpdatedAt} /> : null}
    </div>
  );
}

function Table({ requestId, offers, note, now }: { requestId: string; offers: ComparisonOfferLike[]; note: string; now: number }) {
  const names = useCompanyNames(offers.map((offer) => offer.company_id));
  return <ComparisonTable requestId={requestId} offers={offers} note={note} now={now} names={names} />;
}

/** The offers side by side. `names` maps a company to its name, undefined while loading and null when it is no longer listed. */
export function ComparisonTable({ requestId, offers, note, now, names }: { requestId: string; offers: ComparisonOfferLike[]; note: string; now: number; names: ReadonlyMap<string, string | null | undefined> }) {
  if (offers.length === 0) {
    return (
      <p className="type-body rounded-card border border-line bg-surface p-4 text-ink-2" data-none>
        {text.none}
      </p>
    );
  }
  const rows = compareRows(offers, now);
  return (
    <section aria-label={text.caption} className="space-y-3">
      <Alert variant="info" role="note" data-note>
        <Info aria-hidden />
        <AlertDescription>{note}</AlertDescription>
      </Alert>
      {offers.length === 1 ? (
        <p className="type-body text-ink" data-one>
          {text.oneOnly}
        </p>
      ) : null}
      <TableRegion label={text.region}>
        <DataTable style={{ minWidth: `${12 + offers.length * 12}rem` }} data-compare>
          <caption className="sr-only">{text.caption}</caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className="sticky left-0 z-20 bg-paper-2 p-3 font-semibold">
                {text.item}
              </th>
              {offers.map((offer) => {
                const name = names.get(offer.company_id);
                return (
                  <th key={offer.quotation_id} scope="col" className="min-w-48 p-3 font-semibold" data-offer-column={offer.quotation_id}>
                    <Link href={`/my/requests/${requestId}/offers/${offer.quotation_id}`} className="inline-flex min-h-11 items-center font-semibold text-orange-text underline underline-offset-2">
                      {name === undefined ? "…" : (name ?? messages.customerOffers.list.notListed)}
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="align-top" data-row={row.id} data-differs={row.differs} data-some-unspecified={row.someUnspecified}>
                <th scope="row" className={`sticky left-0 z-10 bg-surface text-left font-normal text-ink-2 ${offers.length > 1 && row.differs ? DIFFERS_EDGE : ""}`}>
                  <span className="block">{row.label}</span>
                  {offers.length > 1 && row.differs ? <DifferenceFlag>{text.differs}</DifferenceFlag> : null}
                  {offers.length > 1 && row.someUnspecified ? <UnspecifiedFlag>{text.someUnspecified}</UnspecifiedFlag> : null}
                </th>
                {row.cells.map((cell, index) => (
                  <td key={offers[index]?.quotation_id ?? index}>
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
    <section aria-labelledby="not-compared-title" className="space-y-3" data-not-compared>
      <h2 id="not-compared-title" className="type-heading text-ink">
        {text.excludedTitle}
      </h2>
      <p className="type-body max-w-reading text-ink-2">{text.excludedIntro}</p>
      <ul className="space-y-2 text-sm">
        {closed.map((item) => {
          const name = names.get(item.company_id) ?? messages.customerOffers.list.notListed;
          return (
            <li key={item.quotation_id} className="rounded-card border border-line bg-surface px-4 py-2 text-ink-2">
              <Link href={`/my/requests/${requestId}/offers/${item.quotation_id}`} className="inline-flex min-h-11 items-center font-medium text-orange-text underline underline-offset-2">
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
