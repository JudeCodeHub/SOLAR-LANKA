"use client";

import Link from "next/link";
import { useState } from "react";

import { OfferDecision } from "@/components/requests/offer-decision";
import { QueryState } from "@/components/query-state";
import { formatLongDate } from "@/lib/catalogue/detail";
import { expiryText, inclusionLabel, INCLUSION_KEYS, inclusionsFromLines, isExpiringSoon, offerState, stateLabel } from "@/lib/quotation/customer";
import { type SentRevision, useOfferHistory, useRequestOffers } from "@/lib/quotation/customer-hooks";
import { formatMoney } from "@/lib/quotation/draft";
import { totalChange } from "@/lib/quotation/lifecycle";
import { useCompanyNames } from "@/lib/requests/hooks";
import { format, messages } from "@/messages";

const text = messages.customerOffers;
const detail = text.detail;
const kinds: Record<string, string> = messages.company.quotation.lines.kinds;

function lineName(line: SentRevision["lines"][number]): string {
  const snapshot = line.product_snapshot as { brand?: string; model?: string } | null;
  const product = snapshot?.brand || snapshot?.model ? `${snapshot?.brand ?? ""} ${snapshot?.model ?? ""}`.trim() : null;
  return product ? `${line.description} (${product})` : line.description;
}

/** One offer in full: its state and expiry, the itemised content, the terms, what it includes, and earlier revisions. */
export function OfferView({ requestId, quotationId }: { requestId: string; quotationId: string }) {
  const history = useOfferHistory(requestId, quotationId);
  const offers = useRequestOffers(requestId);
  const summary = offers.data?.find((offer) => offer.quotation_id === quotationId);
  const names = useCompanyNames(summary ? [summary.company_id] : []);
  const name = summary ? names.get(summary.company_id) : undefined;
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <Link href={`/my/requests/${requestId}`} className="inline-flex min-h-11 items-center text-sm underline underline-offset-2">
        {detail.back}
      </Link>
      <QueryState query={history} isEmpty={(page) => page.items.length === 0} empty={<p className="text-sm">{detail.notFound}</p>}>
        {(page) => <Offer requestId={requestId} quotationId={quotationId} revisions={page.items} companyName={name} now={history.dataUpdatedAt} />}
      </QueryState>
    </div>
  );
}

function Offer({ requestId, quotationId, revisions, companyName, now }: { requestId: string; quotationId: string; revisions: SentRevision[]; companyName: string | null | undefined; now: number }) {
  const [refusedFor, setRefusedFor] = useState<string | null>(null);
  const [current, ...earlier] = revisions as [SentRevision, ...SentRevision[]];
  const state = offerState(current, now);
  const soon = isExpiringSoon(current, now);
  const inclusions = inclusionsFromLines(current.lines);
  const heading = format(detail.title, { name: companyName === undefined ? "…" : (companyName ?? messages.customerOffers.list.notListed) });
  const terms: [string, string | null][] = [
    [detail.capacity, current.capacity_kwp ? format(detail.capacityValue, { value: Number(current.capacity_kwp) }) : null],
    [detail.warranty, current.warranty_terms],
    [detail.exclusions, current.exclusions],
    [detail.notes, current.notes],
  ];
  const money: [string, string | null][] = [
    [detail.subtotal, current.subtotal],
    [detail.discount, current.discount],
    [detail.tax, current.tax],
    [detail.total, current.total],
  ];
  return (
    <>
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{heading}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full border px-2 py-0.5 text-xs" data-state={state}>
            {stateLabel(state)}
          </span>
          <span>{format(detail.revision, { number: current.revision_number })}</span>
          {current.sent_at ? <span className="text-muted-foreground">{format(detail.sentOn, { date: formatLongDate(current.sent_at) ?? current.sent_at })}</span> : null}
        </p>
        <p className="text-sm font-medium" data-expiry>
          {expiryText(current, now)}
        </p>
        {soon ? (
          <p role="status" className="text-sm font-medium" data-soon>
            {text.expiry.soon}
          </p>
        ) : null}
        {state === "expired" ? (
          <p className="text-sm" data-expired-note>
            {text.expiry.expiredNote}
          </p>
        ) : null}
      </header>

      <section aria-labelledby="items-title" className="space-y-3">
        <h2 id="items-title" className="font-heading text-xl font-semibold tracking-tight">
          {detail.itemsTitle}
        </h2>
        {/* A scrollable region must be focusable so keyboard users can scroll it. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <div role="region" aria-label={detail.itemsCaption} tabIndex={0} className="overflow-x-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <table className="w-full min-w-[28rem] text-sm" data-lines>
            <caption className="sr-only">{detail.itemsCaption}</caption>
            <thead>
              <tr className="border-b text-left">
                <th scope="col" className="py-2 pr-3 font-medium">{detail.description}</th>
                <th scope="col" className="py-2 pr-3 font-medium">{detail.quantity}</th>
                <th scope="col" className="py-2 pr-3 font-medium">{detail.unitPrice}</th>
                <th scope="col" className="py-2 text-right font-medium">{detail.lineTotal}</th>
              </tr>
            </thead>
            <tbody>
              {current.lines.map((line) => (
                <tr key={line.position} className="border-b align-top last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    <span className="block text-xs text-muted-foreground">{kinds[line.kind] ?? line.kind}</span>
                    {lineName(line)}
                  </th>
                  <td className="py-2 pr-3">{line.quantity}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatMoney(line.unit_price)}</td>
                  <td className="py-2 text-right whitespace-nowrap">{formatMoney(line.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm" data-totals>
          {money.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className={label === detail.total ? "font-medium" : undefined}>{formatMoney(value) ?? detail.notSpecified}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="terms-title" className="space-y-2">
        <h2 id="terms-title" className="font-heading text-xl font-semibold tracking-tight">
          {detail.termsTitle}
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm" data-terms>
          {terms.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="whitespace-pre-wrap">
                {value ?? <span className="rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground" data-unspecified>{detail.notSpecified}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="inclusions-title" className="space-y-2">
        <h2 id="inclusions-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.inclusions.title}
        </h2>
        <p className="text-sm text-muted-foreground">{text.inclusions.intro}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm" data-inclusions>
          {INCLUSION_KEYS.map((key) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">{inclusionLabel(key)}</dt>
              <dd data-inclusion={inclusions[key]}>
                {inclusions[key] === "included" ? text.inclusions.included : inclusions[key] === "excluded" ? text.inclusions.excluded : text.inclusions.notSpecified}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="earlier-title" className="space-y-2" data-earlier>
        <h2 id="earlier-title" className="font-heading text-xl font-semibold tracking-tight">
          {detail.earlierTitle}
        </h2>
        {earlier.length === 0 ? (
          <p className="text-sm text-muted-foreground">{detail.earlierNone}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{detail.earlierIntro}</p>
            <ul className="space-y-2">
              {earlier.map((revision, index) => {
                const newer = index === 0 ? current : earlier[index - 1];
                const change = newer ? totalChange(revision.total, newer.total) : null;
                return (
                  <li key={revision.id} className="rounded-lg border p-3 text-sm" data-earlier-revision={revision.revision_number}>
                    <details>
                      <summary className="cursor-pointer font-medium">
                        {format(detail.earlierSummary, {
                          number: revision.revision_number,
                          state: stateLabel(offerState(revision, now)),
                          total: formatMoney(revision.total) ?? detail.notSpecified,
                        })}
                      </summary>
                      <p className="mt-2 text-muted-foreground">
                        {format(detail.earlierMeta, {
                          sent: revision.sent_at ? format(detail.sentOn, { date: formatLongDate(revision.sent_at) ?? revision.sent_at }) : "",
                          change: change ?? "",
                        })}
                      </p>
                      <ul className="mt-1 list-disc pl-5">
                        {revision.lines.map((line) => (
                          <li key={line.position}>
                            {format(detail.earlierLine, { name: lineName(line), quantity: line.quantity, total: formatMoney(line.line_total) ?? detail.notSpecified })}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* Keyed by the revision so a newer one arriving closes any open confirmation instead of changing what it accepts. */}
      <OfferDecision key={current.id} refusedFor={refusedFor} setRefusedFor={setRefusedFor} requestId={requestId} quotationId={quotationId} revision={current} companyName={companyName ?? messages.customerOffers.list.notListed} now={now} />
      <Link href={`/my/requests/${requestId}/compare`} className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-2">
        {detail.comparePrompt}
      </Link>
    </>
  );
}
