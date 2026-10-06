import { RangeBar } from "@/components/ui/range-bar";
import { Table, TableRegion } from "@/components/ui/table";
import { niceMax } from "@/lib/dial/dial";
import type { ResultRow } from "@/lib/estimator/results";
import { messages } from "@/messages";

const text = messages.estimator.results;

/** Estimates as a captioned table. */
export function ResultTable({ caption, rows }: { caption: string; rows: ResultRow[] }) {
  return (
    <TableRegion label={caption}>
      <Table className="min-w-[32rem]">
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
                  <span className="block space-y-1.5">
                    <span className="type-figure block font-semibold text-ink">{row.value}</span>
                    {row.range ? <RangeBar low={row.range.low} high={row.range.high} max={niceMax(row.range.high)} /> : null}
                  </span>
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
      </Table>
    </TableRegion>
  );
}
