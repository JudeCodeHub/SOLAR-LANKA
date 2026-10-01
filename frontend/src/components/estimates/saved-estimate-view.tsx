"use client";

import Link from "next/link";

import { EstimateResults, type SubmittedValues } from "@/components/estimator/estimate-results";
import { QueryState } from "@/components/query-state";
import { formatLongDate } from "@/lib/catalogue/detail";
import { settingRows } from "@/lib/estimates/assumptions";
import { useSavedEstimate } from "@/lib/estimates/hooks";
import { format, messages } from "@/messages";

const text = messages.estimator.saved.detail;

/** Unknown (null) is blank, never "null" or 0. */
const textOf = (value: string | number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

/**
 * A saved estimate exactly as it was calculated: its stored inputs and result, the sources and
 * every setting value it used. Nothing here is recalculated, so a later update to the estimator
 * never changes it.
 */
export function SavedEstimateView({ id }: { id: string }) {
  const query = useSavedEstimate(id);
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <Link href="/my/estimates" className="text-sm underline underline-offset-2">
        {text.back}
      </Link>
      <QueryState query={query}>
        {(saved) => {
          const inputs = saved.inputs;
          const values: SubmittedValues = {
            monthly_consumption_kwh: String(inputs.monthly_consumption_kwh),
            district: inputs.district,
            usable_roof_area_m2: String(inputs.usable_roof_area_m2),
            shading_condition: inputs.shading_condition ?? "",
            daytime_consumption_percent: textOf(inputs.daytime_consumption_percent),
            monthly_bill_lkr: textOf(inputs.monthly_bill_lkr),
          };
          const rows = settingRows(saved.configuration.assumptions);
          return (
            <>
              <header className="space-y-2">
                <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
                <p className="text-sm text-muted-foreground">
                  {format(text.savedOn, { date: formatLongDate(saved.created_at) ?? saved.created_at })}
                </p>
              </header>
              <EstimateResults preview={saved.estimate} values={values} />
              <section aria-labelledby="settings-title" className="space-y-3">
                <h2 id="settings-title" className="font-heading text-2xl font-semibold tracking-tight">
                  {text.settingsTitle}
                </h2>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  {format(text.settingsIntro, {
                    version: saved.configuration.version,
                    date: formatLongDate(saved.configuration.published_at) ?? saved.configuration.published_at,
                  })}
                </p>
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{text.settingsNone}</p>
                ) : (
                  <table className="w-full text-sm" data-settings>
                    <caption className="sr-only">{text.settingsTitle}</caption>
                    <thead>
                      <tr className="border-b text-left">
                        <th scope="col" className="py-1 pr-4 font-medium">
                          {text.setting}
                        </th>
                        <th scope="col" className="py-1 font-medium">
                          {text.value}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.label} className="border-b align-top last:border-0">
                          <th scope="row" className="py-1 pr-4 text-left font-normal">
                            {row.label}
                          </th>
                          <td className="py-1">{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
              <Link href="/estimator" className="inline-block text-sm underline underline-offset-2">
                {text.newEstimate}
              </Link>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
