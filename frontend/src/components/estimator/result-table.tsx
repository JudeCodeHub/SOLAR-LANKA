import type { ResultRow } from "@/lib/estimator/results";
import { messages } from "@/messages";

const text = messages.estimator.results;

/**
 * Estimates as a captioned table. A figure that is not available keeps its row and says what is
 * missing, so an absent number is never mistaken for zero. Money rows carry the Indicative label.
 */
export function ResultTable({ caption, rows }: { caption: string; rows: ResultRow[] }) {
  return (
    <div
      role="region"
      aria-label={caption}
      // A scrollable region must be focusable so keyboard users can scroll it (WCAG 2.1.1).
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className="overflow-x-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <table className="w-full min-w-[32rem] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="py-2 pr-4 font-medium">
              {text.table.measure}
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              {text.table.estimate}
            </th>
            <th scope="col" className="py-2 font-medium">
              {text.table.unit}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b align-top last:border-0" data-row={row.id}>
              <th scope="row" className="py-2 pr-4 text-left font-normal">
                {row.label}
                {row.indicative ? (
                  <span className="ml-2 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                    {messages.estimator.results.financial.indicative}
                  </span>
                ) : null}
              </th>
              <td className="py-2 pr-4">
                {row.value !== null ? (
                  <span className="font-medium">{row.value}</span>
                ) : (
                  <span data-unavailable>
                    <span className="rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
                      {text.table.notAvailable}
                    </span>
                    <span className="mt-1 block text-muted-foreground">{row.why}</span>
                  </span>
                )}
              </td>
              <td className="py-2 text-muted-foreground">{row.value !== null ? row.unit : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
