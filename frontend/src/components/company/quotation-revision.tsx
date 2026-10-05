"use client";

import { Table } from "@/components/ui/table";
import { ApiErrorMessage } from "@/components/api-error-message";
import { Button } from "@/components/ui/button";
import { formatLongDate } from "@/lib/catalogue/detail";
import { useCompanyPdf } from "@/lib/quotation/export-hooks";
import { effectiveStatus, statusLabel, totalChange } from "@/lib/quotation/lifecycle";
import type { Revision } from "@/lib/quotation/hooks";
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
    <div className="space-y-3 text-sm" data-revision-body>
      <div>
        <h3 className="font-medium">{history.lines}</h3>
        <Table className="mt-1 w-full" data-revision-lines>
          <caption className="sr-only">{history.lines}</caption>
          <tbody>
            {revision.lines.map((line) => (
              <tr key={line.position} className="border-b align-top last:border-0">
                <th scope="row" className="py-1 pr-3 text-left font-normal">
                  <span className="text-muted-foreground">{kinds[line.kind] ?? line.kind}: </span>
                  {lineName(line)}
                </th>
                <td className="py-1 pr-3 whitespace-nowrap">
                  {format(history.times, { quantity: line.quantity, price: formatMoney(line.unit_price) ?? "" })}
                </td>
                <td className="py-1 text-right whitespace-nowrap">{formatMoney(line.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <p>
        {format(history.totals, {
          subtotal: formatMoney(revision.subtotal) ?? "",
          discount: formatMoney(revision.discount) ?? "",
          tax: formatMoney(revision.tax) ?? "",
          total: formatMoney(revision.total) ?? "",
        })}
      </p>
      <div className="space-y-1">
        <h3 className="font-medium">{history.terms}</h3>
        {revision.capacity_kwp ? <p>{format(history.capacity, { value: Number(revision.capacity_kwp) })}</p> : null}
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
    <section aria-labelledby="history-title" className="space-y-3" data-history>
      <h2 id="history-title" className="font-heading text-xl font-semibold tracking-tight">
        {history.title}
      </h2>
      <p className="text-sm text-muted-foreground">{history.intro}</p>
      {revisions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{history.empty}</p>
      ) : (
        <ul className="space-y-3">
          {revisions.map((revision, index) => {
            const older = revisions[index + 1];
            const change = older ? totalChange(older.total, revision.total) : null;
            const status = effectiveStatus(revision, now);
            return (
              <li key={revision.id} className="rounded-lg border p-3" data-revision={revision.revision_number} data-status={status}>
                <details>
                  <summary className="cursor-pointer text-sm font-medium">
                    {format(history.revision, { number: revision.revision_number })}
                    {" · "}
                    {statusLabel(revision, now)}
                    {revision.total ? ` · ${formatMoney(revision.total)}` : ""}
                  </summary>
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {revision.sent_at
                        ? format(history.sentOnly, { date: formatLongDate(revision.sent_at) ?? revision.sent_at })
                        : history.draftNote}
                      {change ? ` · ${change}` : ""}
                    </p>
                    <RevisionBody revision={revision} />
                    {revision.sent_at ? (
                      <Button type="button" variant="outline" size="sm" aria-disabled={pdf.isPending} data-pdf-download onClick={() => !pdf.isPending && pdf.mutate({ revisionId: revision.id, revisionNumber: revision.revision_number })}>
                        {history.downloadPdf}
                      </Button>
                    ) : null}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      {pdf.error ? <ApiErrorMessage error={pdf.error} /> : null}
    </section>
  );
}
