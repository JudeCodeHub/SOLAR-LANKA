import { Calculator, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/quotation/draft";
import { messages } from "@/messages";

const text = messages.company.quotation;

/** The amounts of a quotation, exactly as the server worked them out from the saved lines: shown as text, never typed, and marked as stale once the form has unsaved changes. */
export function TotalsPanel({ terms, dirty }: { terms: { subtotal: string | null; discount: string | null; tax: string | null; total: string | null }; dirty: boolean }) {
  const totals: [string, string | null][] = [
    [text.totals.subtotal, terms.subtotal],
    [text.totals.discount, terms.discount],
    [text.totals.tax, terms.tax],
    [text.totals.total, terms.total],
  ];
  return (
    <section aria-labelledby="totals-title" className="space-y-3 rounded-card border-2 border-orange-text bg-surface p-5 shadow-e2" data-totals>
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="totals-title" className="type-heading text-ink">
          {text.totals.title}
        </h2>
        <Badge variant="info" icon={Calculator} data-badge="server">
          {text.totals.badge}
        </Badge>
      </div>
      <p className="type-small text-ink-2">{text.totals.intro}</p>
      {terms.total === null ? (
        <p className="type-body text-ink-2" data-no-totals>
          {text.totals.none}
        </p>
      ) : (
        <>
          {dirty ? (
            <p className="flex items-center gap-2 text-sm font-medium text-warning" data-totals-stale>
              <TriangleAlert aria-hidden className="size-4 shrink-0" />
              {text.totals.stale}
            </p>
          ) : null}
          <dl className="description-list text-sm">
            {totals.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-ink-2">{label}</dt>
                <dd className={label === text.totals.total ? "type-figure text-base font-semibold" : "type-figure"} data-total={label}>
                  {formatMoney(value) ?? ""}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
