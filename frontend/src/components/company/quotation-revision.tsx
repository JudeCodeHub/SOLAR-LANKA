"use client";

import { Download, Lock } from "lucide-react";

import { AccordionItem } from "@/components/ui/accordion";
import { Table, TableRegion } from "@/components/ui/table";
import { ApiErrorMessage } from "@/components/api-error-message";
import { Button } from "@/components/ui/button";
import { formatLongDate } from "@/lib/catalogue/detail";
import { useCompanyPdf } from "@/lib/quotation/export-hooks";
import { effectiveStatus, statusLabel, totalChange } from "@/lib/quotation/lifecycle";
import type { Revision } from "@/lib/quotation/hooks";
import { formatKwp } from "@/lib/format/figures";
import { formatMoney } from "@/lib/quotation/draft";
import { format, messages } from "@/messages";

const text = messages.company.quotation.lifecycle;
const history = text.history;
const kinds: Record<string, string> = messages.company.quotation.lines.kinds;

function lineName(line: Revision["lines"][number]): string {
  const snapshot = line.product_snapshot as { brand?: string; model?: string } | null;
  const product = snapshot?.brand || snapshot?.model ? `${snapshot?.brand ?? ""} ${snapshot?.model ?? ""}`.trim() : null;
  return product ? `${line.description} (${product})` : line.description;
}

/** A revision's content, read-only, exactly as stored. */
export function RevisionBody({ revision }: { revision: Revision }) {
  return (
    <div className="space-y-4 text-sm" data-revision-body>
      <div className="space-y-2">
        <h3 className="type-subheading text-ink">{history.lines}</h3>
        <TableRegion label={history.lines}>
        <Table className="w-full" data-revision-lines>
          <caption className="sr-only">{history.lines}</caption>
          <tbody>
            {revision.lines.map((line) => (
              <tr key={line.position} className="align-top">
                <th scope="row" className="text-left font-normal">
                  <span className="text-ink-2">{kinds[line.kind] ?? line.kind}: </span>
                  {lineName(line)}
                </th>
                <td className="type-figure whitespace-nowrap">
                  {format(history.times, { quantity: line.quantity, price: formatMoney(line.unit_price) ?? "" })}
                </td>
                <td className="type-figure text-right whitespace-nowrap">{formatMoney(line.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        </TableRegion>
      </div>
      <p className="type-figure rounded-field bg-paper-2 px-3 py-2 text-ink" data-revision-totals>
        {format(history.totals, {
          subtotal: formatMoney(revision.subtotal) ?? "",
          discount: formatMoney(revision.discount) ?? "",
          tax: formatMoney(revision.tax) ?? "",
          total: formatMoney(revision.total) ?? "",
        })}
      </p>
      <div className="space-y-1.5 text-ink">
        <h3 className="type-subheading">{history.terms}</h3>
        {revision.capacity_kwp ? <p>{format(history.capacity, { value: formatKwp(revision.capacity_kwp) ?? "" })}</p> : null}
        {revision.warranty_terms ? <p className="whitespace-pre-wrap">{format(history.warranty, { value: revision.warranty_terms })}</p> : null}
        {revision.exclusions ? <p className="whitespace-pre-wrap">{format(history.exclusions, { value: revision.exclusions })}</p> : null}
        {revision.notes ? <p className="whitespace-pre-wrap">{format(history.notes, { value: revision.notes })}</p> : null}
      </div>
    </div>
  );
}

/** Every revision, newest first. Sent revisions are shown as the customer saw them and are never editable. */
export function RevisionHistory({ revisions, now, ids }: { revisions: readonly Revision[]; now: number; ids: { companyId: string; deliveryId: string; quotationId: string } }) {
  const pdf = useCompanyPdf(ids.companyId, ids.deliveryId, ids.quotationId);
  return (
    <section aria-labelledby="history-title" className="space-y-4" data-history>
      <h2 id="history-title" className="type-heading text-ink">
        {history.title}
      </h2>
      <p className="type-body max-w-reading text-ink-2">{history.intro}</p>
      {revisions.length === 0 ? (
        <p className="type-body text-ink-2">{history.empty}</p>
      ) : (
        <ul className="space-y-3">
          {revisions.map((revision, index) => {
            const older = revisions[index + 1];
            const change = older ? totalChange(older.total, revision.total) : null;
            const status = effectiveStatus(revision, now);
            return (
              <li key={revision.id}>
                <AccordionItem
                  data-revision={revision.revision_number}
                  data-status={status}
                  title={`${format(history.revision, { number: revision.revision_number })} · ${statusLabel(revision, now)}${revision.total ? ` · ${formatMoney(revision.total)}` : ""}`}
                >
                  <p className="flex flex-wrap items-center gap-2 text-ink-2">
                    {revision.sent_at ? <Lock aria-hidden className="size-4 shrink-0" /> : null}
                    {revision.sent_at
                      ? format(history.sentOnly, { date: formatLongDate(revision.sent_at) ?? revision.sent_at })
                      : history.draftNote}
                    {change ? ` · ${change}` : ""}
                  </p>
                  <RevisionBody revision={revision} />
                  {revision.sent_at ? (
                    <Button type="button" variant="outline" aria-disabled={pdf.isPending} data-pdf-download onClick={() => !pdf.isPending && pdf.mutate({ revisionId: revision.id, revisionNumber: revision.revision_number })}>
                      <Download aria-hidden />
                      {history.downloadPdf}
                    </Button>
                  ) : null}
                </AccordionItem>
              </li>
            );
          })}
        </ul>
      )}
      {pdf.error ? <ApiErrorMessage error={pdf.error} /> : null}
    </section>
  );
}
