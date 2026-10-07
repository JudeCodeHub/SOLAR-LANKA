"use client";

import { BackLink } from "@/components/ui/back-link";
import { Table, TableRegion } from "@/components/ui/table";
import { Check, CircleHelp, Clock, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AccordionItem } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { OfferExport } from "@/components/requests/offer-export";
import { OfferDecision } from "@/components/requests/offer-decision";
import { QueryState } from "@/components/query-state";
import { formatLongDate } from "@/lib/catalogue/detail";
import { expiryText, inclusionLabel, INCLUSION_KEYS, inclusionsFromLines, isExpiringSoon, offerState, stateLabel, stateTone } from "@/lib/quotation/customer";
import { type SentRevision, useOfferHistory, useRequestOffers } from "@/lib/quotation/customer-hooks";
import { formatKwp } from "@/lib/format/figures";
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
      <BackLink href={`/my/requests/${requestId}`}>{detail.back}</BackLink>
      <QueryState query={history} isEmpty={(page) => page.items.length === 0} empty={<p className="type-body rounded-card border border-line bg-surface p-4 text-ink" data-not-found>{detail.notFound}</p>}>
        {(page) => <Offer requestId={requestId} quotationId={quotationId} revisions={page.items} companyName={name} now={history.dataUpdatedAt} />}
      </QueryState>
    </div>
  );
}

function Offer({ requestId, quotationId, revisions, companyName, now }: { requestId: string; quotationId: string; revisions: SentRevision[]; companyName: string | null | undefined; now: number }) {
  const [refusedFor, setRefusedFor] = useState<string | null>(null);
  const [current] = revisions as [SentRevision, ...SentRevision[]];
  return (
    <>
      <OfferDetails revisions={revisions} companyName={companyName} now={now} />

      <OfferExport key={current.id} requestId={requestId} quotationId={quotationId} revisionId={current.id} revisionNumber={current.revision_number} />

      {/* Keyed by the revision so a newer one arriving closes any open confirmation instead of changing what it accepts. */}
      <OfferDecision key={current.id} refusedFor={refusedFor} setRefusedFor={setRefusedFor} requestId={requestId} quotationId={quotationId} revision={current} companyName={companyName ?? messages.customerOffers.list.notListed} now={now} />
      <Link href={`/my/requests/${requestId}/compare`} className={buttonVariants({ variant: "secondary" })}>
        {detail.comparePrompt}
      </Link>
    </>
  );
}

/** What the offer says, exactly as sent: state and expiry, the itemised content, the terms, what it includes and earlier revisions. Newest revision first. */
export function OfferDetails({ revisions, companyName, now }: { revisions: SentRevision[]; companyName: string | null | undefined; now: number }) {
  const [current, ...earlier] = revisions as [SentRevision, ...SentRevision[]];
  const state = offerState(current, now);
  const soon = isExpiringSoon(current, now);
  const inclusions = inclusionsFromLines(current.lines);
  const heading = format(detail.title, { name: companyName === undefined ? "…" : (companyName ?? messages.customerOffers.list.notListed) });
  const terms: [string, string | null][] = [
    [detail.capacity, current.capacity_kwp ? formatKwp(current.capacity_kwp) : null],
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
  const card = "space-y-3 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6";
  return (
    <>
      <header className="space-y-3 rounded-panel border border-line bg-surface p-6 shadow-e1" data-offer-header>
        <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{detail.eyebrow}</p>
        <h1 className="type-display-m text-ink">{heading}</h1>
        <p className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant={stateTone(state)} data-state={state}>
            {stateLabel(state)}
          </Badge>
          <span className="text-ink">{format(detail.revision, { number: current.revision_number })}</span>
          {current.sent_at ? <span className="text-ink-2">{format(detail.sentOn, { date: formatLongDate(current.sent_at) ?? current.sent_at })}</span> : null}
        </p>
        <p className="type-figure text-3xl font-semibold text-ink" data-headline-total>
          {formatMoney(current.total) ?? detail.notSpecified}
        </p>
        <p className="type-body font-medium text-ink" data-expiry>
          {expiryText(current, now)}
        </p>
        {soon ? (
          <Alert variant="warning" role="status" data-soon>
            <Clock aria-hidden />
            <AlertDescription>{text.expiry.soon}</AlertDescription>
          </Alert>
        ) : null}
        {state === "expired" ? (
          <p className="type-body text-ink-2" data-expired-note>
            {text.expiry.expiredNote}
          </p>
        ) : null}
      </header>

      <section aria-labelledby="items-title" className={card}>
        <h2 id="items-title" className="type-heading text-ink">
          {detail.itemsTitle}
        </h2>
        <TableRegion label={detail.itemsCaption}>
          <Table className="min-w-[28rem]" data-lines>
            <caption className="sr-only">{detail.itemsCaption}</caption>
            <thead>
              <tr className="text-left">
                <th scope="col">{detail.description}</th>
                <th scope="col">{detail.quantity}</th>
                <th scope="col">{detail.unitPrice}</th>
                <th scope="col" className="text-right">{detail.lineTotal}</th>
              </tr>
            </thead>
            <tbody>
              {current.lines.map((line) => (
                <tr key={line.position} className="align-top">
                  <th scope="row" className="text-left font-normal">
                    <span className="block text-xs text-ink-2">{kinds[line.kind] ?? line.kind}</span>
                    {lineName(line)}
                  </th>
                  <td className="type-figure">{line.quantity}</td>
                  <td className="type-figure whitespace-nowrap">{formatMoney(line.unit_price)}</td>
                  <td className="type-figure text-right whitespace-nowrap">{formatMoney(line.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableRegion>
        <dl className="description-list text-sm" data-totals>
          {money.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-ink-2">{label}</dt>
              <dd className={label === detail.total ? "type-figure text-base font-semibold" : "type-figure"}>{formatMoney(value) ?? detail.notSpecified}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="terms-title" className={card}>
        <h2 id="terms-title" className="type-heading text-ink">
          {detail.termsTitle}
        </h2>
        <dl className="description-list text-sm" data-terms>
          {terms.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-ink-2">{label}</dt>
              <dd className="whitespace-pre-wrap">{value ?? <span className="rounded-full border border-dashed border-field-border px-2.5 py-0.5 text-xs text-ink-2" data-unspecified>{detail.notSpecified}</span>}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="inclusions-title" className={card}>
        <h2 id="inclusions-title" className="type-heading text-ink">
          {text.inclusions.title}
        </h2>
        <p className="type-small text-ink-2">{text.inclusions.intro}</p>
        <dl className="description-list text-sm" data-inclusions>
          {INCLUSION_KEYS.map((key) => (
            <div key={key} className="contents">
              <dt className="text-ink-2">{inclusionLabel(key)}</dt>
              <dd data-inclusion={inclusions[key]}>
                <Badge variant={inclusions[key] === "included" ? "success" : "neutral"} icon={inclusions[key] === "included" ? Check : inclusions[key] === "excluded" ? X : CircleHelp} className={inclusions[key] === "not_specified" ? "border-dashed" : undefined}>
                  {inclusions[key] === "included" ? text.inclusions.included : inclusions[key] === "excluded" ? text.inclusions.excluded : text.inclusions.notSpecified}
                </Badge>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="earlier-title" className={card} data-earlier>
        <h2 id="earlier-title" className="type-heading text-ink">
          {detail.earlierTitle}
        </h2>
        {earlier.length === 0 ? (
          <p className="type-small text-ink-2">{detail.earlierNone}</p>
        ) : (
          <>
            <p className="type-small text-ink-2">{detail.earlierIntro}</p>
            <ul className="space-y-3">
              {earlier.map((revision, index) => {
                const newer = index === 0 ? current : earlier[index - 1];
                const change = newer ? totalChange(revision.total, newer.total) : null;
                return (
                  <li key={revision.id}>
                    <AccordionItem
                      data-earlier-revision={revision.revision_number}
                      title={format(detail.earlierSummary, {
                        number: revision.revision_number,
                        state: stateLabel(offerState(revision, now)),
                        total: formatMoney(revision.total) ?? detail.notSpecified,
                      })}
                    >
                      <p className="text-ink-2">
                        {format(detail.earlierMeta, {
                          sent: revision.sent_at ? format(detail.sentOn, { date: formatLongDate(revision.sent_at) ?? revision.sent_at }) : "",
                          change: change ?? "",
                        })}
                      </p>
                      <ul className="list-disc space-y-1 pl-5">
                        {revision.lines.map((line) => (
                          <li key={line.position}>
                            {format(detail.earlierLine, { name: lineName(line), quantity: line.quantity, total: formatMoney(line.line_total) ?? detail.notSpecified })}
                          </li>
                        ))}
                      </ul>
                    </AccordionItem>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
