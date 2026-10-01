"use client";

import dynamic from "next/dynamic";
import type { ReactNode, Ref } from "react";

import { ExternalLink } from "@/components/catalogue/detail/external-link";
import { ResultTable } from "@/components/estimator/result-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatLongDate, safeExternalUrl } from "@/lib/catalogue/detail";
import {
  chartSpecs,
  financialRows,
  type Preview,
  roofNote,
  sizingRows,
} from "@/lib/estimator/results";
import { format, messages } from "@/messages";

const text = messages.estimator.results;
const about = text.assumptions;

// The chart library is only needed once there is a result to draw.
const ResultChart = dynamic(() => import("@/components/estimator/result-chart"), { ssr: false });

/** The raw form values the estimate was calculated from. */
export interface SubmittedValues {
  monthly_consumption_kwh: string;
  district: string;
  usable_roof_area_m2: string;
  shading_condition: string;
  daytime_consumption_percent: string;
  monthly_bill_lkr: string;
}

const SHADING_LABEL: Record<string, string> = messages.estimator.fields.shadingOptions;

/**
 * The estimate: sizing and generation, indicative costs and savings (each with what is missing
 * when it cannot be given), charts with table alternatives, and the assumptions, inputs and
 * sources behind the numbers. The inputs shown are the ones the estimate was calculated from, even
 * if the form has been edited since.
 */
export function EstimateResults({
  preview,
  values,
  stale = false,
  headingRef,
  actions,
}: {
  preview: Preview;
  values: SubmittedValues;
  stale?: boolean;
  headingRef?: Ref<HTMLHeadingElement>;
  /** Controls shown under the heading, such as saving the estimate. */
  actions?: ReactNode;
}) {
  const sent = {
    shading_condition: values.shading_condition === "" ? null : values.shading_condition,
    daytime_consumption_percent:
      values.daytime_consumption_percent === "" ? null : values.daytime_consumption_percent,
  };
  const note = roofNote(preview);
  const charts = chartSpecs(preview, values.monthly_consumption_kwh);
  const unknown = about.unknown;
  const inputRows: [string, string][] = [
    [about.inputs.consumption, `${values.monthly_consumption_kwh} ${text.units.kwhPerMonth}`],
    [about.inputs.district, values.district],
    [about.inputs.roof, `${values.usable_roof_area_m2} ${text.units.m2}`],
    [about.inputs.shading, SHADING_LABEL[values.shading_condition === "" ? "unknown" : values.shading_condition] ?? unknown],
    [about.inputs.daytime, values.daytime_consumption_percent === "" ? unknown : `${values.daytime_consumption_percent} %`],
    [about.inputs.bill, values.monthly_bill_lkr === "" ? unknown : `${values.monthly_bill_lkr} ${text.units.lkrPerMonth}`],
  ];

  return (
    <section aria-labelledby="results-title" className="space-y-8" data-results>
      <header className="space-y-2">
        <h2
          id="results-title"
          ref={headingRef}
          tabIndex={-1}
          className="font-heading text-2xl font-semibold tracking-tight outline-none"
        >
          {text.title}
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{text.planning}</p>
        {actions}
      </header>

      {stale ? (
        <Alert role="status" data-stale>
          <AlertDescription>{text.stale}</AlertDescription>
        </Alert>
      ) : null}

      <section aria-labelledby="sizing-title" className="space-y-3">
        <h3 id="sizing-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.sizing.title}
        </h3>
        <p className="max-w-3xl text-sm text-muted-foreground">{text.sizing.intro}</p>
        {note === "none" ? (
          <p className="text-sm" data-roof-note>{text.noRoom}</p>
        ) : note === "limited" ? (
          <p className="text-sm" data-roof-note>
            {preview.sizing.roof_panel_capacity === 1
              ? text.roofLimitedOne
              : format(text.roofLimited, { count: preview.sizing.roof_panel_capacity })}
          </p>
        ) : null}
        <ResultTable caption={text.sizing.caption} rows={sizingRows(preview, sent)} />
      </section>

      <section aria-labelledby="financial-title" className="space-y-3">
        <h3 id="financial-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.financial.title}
        </h3>
        <p className="max-w-3xl text-sm text-muted-foreground">{text.financial.intro}</p>
        <ResultTable caption={text.financial.caption} rows={financialRows(preview, sent)} />
      </section>

      {charts.length > 0 ? (
        <div className="grid gap-8" data-charts>
          {charts.map((spec) => (
            <ResultChart key={spec.id} spec={spec} />
          ))}
        </div>
      ) : null}

      <section aria-labelledby="assumptions-title" className="space-y-4">
        <h3 id="assumptions-title" className="font-heading text-xl font-semibold tracking-tight">
          {about.title}
        </h3>
        <div className="space-y-1 text-sm">
          <h4 className="font-medium">{about.fixedTitle}</h4>
          <p className="text-muted-foreground">{about.fixed}</p>
          <p className="text-muted-foreground">
            {format(about.version, { version: preview.config_version })}
          </p>
        </div>
        <div className="space-y-1 text-sm">
          <h4 className="font-medium">{about.inputsTitle}</h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
            {inputRows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="space-y-3 text-sm">
          <h4 className="font-medium">{about.sourcesTitle}</h4>
          <ul className="space-y-3">
            {(["yield", "tariff", "cost"] as const).map((topic) => {
              const source = preview.sources[topic];
              const link = safeExternalUrl(source?.url);
              return (
                <li key={topic} className="rounded-md border p-3" data-source={topic}>
                  <p className="font-medium">{about.sourceNames[topic]}</p>
                  {source ? (
                    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
                      {source.publisher ? <Item label={about.publisher} value={source.publisher} /> : null}
                      {source.title ? <Item label={about.document} value={source.title} /> : null}
                      {source.unit ? <Item label={about.unit} value={source.unit} /> : null}
                      {formatLongDate(source.reviewed_on) ? (
                        <Item label={about.reviewed} value={formatLongDate(source.reviewed_on) ?? ""} />
                      ) : null}
                      {formatLongDate(source.effective_from) ? (
                        <Item label={about.effective} value={formatLongDate(source.effective_from) ?? ""} />
                      ) : null}
                      {source.limitation ? <Item label={about.limitation} value={source.limitation} /> : null}
                      {link ? (
                        <>
                          <dt className="text-muted-foreground">{about.link}</dt>
                          <dd>
                            <ExternalLink href={link}>{source.publisher ?? about.link}</ExternalLink>
                          </dd>
                        </>
                      ) : null}
                    </dl>
                  ) : (
                    <p className="text-muted-foreground">{about.sourceNone}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">{preview.disclaimer}</p>
      </section>
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

