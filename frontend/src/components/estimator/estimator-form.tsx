"use client";

import { useEffect, useRef, useState } from "react";
import { useWatch } from "react-hook-form";

import { SaveEstimate } from "@/components/estimates/save-estimate";
import { EstimateResults, type SubmittedValues } from "@/components/estimator/estimate-results";
import { UnsupportedNotice } from "@/components/estimator/unsupported-notice";
import { AppForm } from "@/components/forms/app-form";
import { RadioCardsField } from "@/components/forms/radio-cards-field";
import { SelectField } from "@/components/forms/select-field";
import { FormSubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { createBrowserApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { DISTRICTS } from "@/lib/directory/options";
import { unsupportedParts } from "@/lib/estimator/scenario";
import { estimatorDefaults, estimatorSchema } from "@/lib/estimator/schema";
import { useAppForm } from "@/lib/forms/use-app-form";
import { messages } from "@/messages";

const api = createBrowserApi();
const text = messages.estimator;
const fields = text.fields;

type Preview = components["schemas"]["EstimatePreviewResponse"];
type Request = components["schemas"]["EstimatorInputs-Input"];

const options = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

/** The estimator input form. */
export function EstimatorForm() {
  const form = useAppForm(estimatorSchema, { defaultValues: { ...estimatorDefaults } });
  const [result, setResult] = useState<{ preview: Preview; values: SubmittedValues; request: Request; run: number } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const runs = useRef(0);
  const current = useWatch({ control: form.control });
  const [scheme, systemType, backup] = useWatch({
    control: form.control,
    name: ["connection_scheme", "system_type", "backup"],
  });
  const problems = unsupportedParts({
    connection_scheme: scheme,
    system_type: systemType,
    backup,
  });

  // Move focus to the new estimate so keyboard and screen reader users land on it.
  useEffect(() => {
    if (result) headingRef.current?.focus();
  }, [result]);
  const stale =
    result !== null &&
    (Object.keys(result.values) as (keyof SubmittedValues)[]).some(
      (key) => (current as Record<string, unknown>)[key] !== result.values[key],
    );

  return (
    <div className="space-y-10">
    <AppForm
      form={form}
      className="space-y-8"
      onSubmit={async (payload) => {
        const preview = await unwrap(() => api.POST("/estimates/preview", { body: payload }));
        const all = form.getValues();
        runs.current += 1;
        setResult({
          preview,
          run: runs.current,
          request: payload,
          values: {
            connection_scheme: all.connection_scheme,
            monthly_consumption_kwh: all.monthly_consumption_kwh,
            district: all.district,
            usable_roof_area_m2: all.usable_roof_area_m2,
            shading_condition: all.shading_condition,
            daytime_consumption_percent: all.daytime_consumption_percent,
            monthly_bill_lkr: all.monthly_bill_lkr,
          },
        });
      }}
    >
      <ol aria-hidden className="flex items-center gap-2 sm:gap-4" data-progress>
        {[text.sections.usage, text.sections.roof, text.sections.scenario].map((title, index) => (
          <li key={title} className="flex flex-1 items-center gap-2 text-xs font-medium text-ink-2 sm:text-sm">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-orange-tint text-orange-text type-figure">{index + 1}</span>
            <span className="hidden sm:inline">{title}</span>
            <span className="h-px flex-1 bg-line last:hidden" />
          </li>
        ))}
      </ol>

      <fieldset className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" data-section="usage">
        <legend className="type-subheading float-left mb-4 flex w-full items-center gap-3 text-ink">
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-orange-tint text-orange-text type-figure">{1}</span>
          {text.sections.usage}
        </legend>
        <TextField
          form={form}
          name="monthly_consumption_kwh"
          label={fields.consumption}
          description={fields.consumptionHelp}
          inputMode="decimal"
        />
        <TextField
          form={form}
          name="monthly_bill_lkr"
          label={fields.bill}
          description={fields.billHelp}
          inputMode="decimal"
          placeholder={fields.unknown}
          optional
        />
        <TextField
          form={form}
          name="daytime_consumption_percent"
          label={fields.daytime}
          description={fields.daytimeHelp}
          inputMode="decimal"
          placeholder={fields.unknown}
          optional
        />
      </fieldset>

      <fieldset className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" data-section="roof">
        <legend className="type-subheading float-left mb-4 flex w-full items-center gap-3 text-ink">
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-orange-tint text-orange-text type-figure">{2}</span>
          {text.sections.roof}
        </legend>
        <SelectField
          form={form}
          name="district"
          label={fields.district}
          description={fields.districtHelp}
          placeholder={fields.districtPlaceholder}
          options={DISTRICTS.map((district) => ({ value: district, label: district }))}
        />
        <TextField
          form={form}
          name="usable_roof_area_m2"
          label={fields.roof}
          description={fields.roofHelp}
          inputMode="decimal"
        />
        <SelectField
          form={form}
          name="shading_condition"
          label={fields.shading}
          description={fields.shadingHelp}
          options={[
            { value: "", label: fields.shadingOptions.unknown },
            { value: "none", label: fields.shadingOptions.none },
            { value: "partial", label: fields.shadingOptions.partial },
            { value: "heavy", label: fields.shadingOptions.heavy },
          ]}
          optional
        />
      </fieldset>

      <fieldset className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" data-section="scenario">
        <legend className="type-subheading float-left mb-4 flex w-full items-center gap-3 text-ink">
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-orange-tint text-orange-text type-figure">{3}</span>
          {text.sections.scenario}
        </legend>
        <RadioCardsField
          form={form}
          name="connection_scheme"
          label={fields.scheme}
          description={fields.schemeHelp}
          cards={Object.entries(fields.schemeCards).map(([value, card]) => ({ value, ...card }))}
        />
        <SelectField
          form={form}
          name="system_type"
          label={fields.systemType}
          description={fields.systemTypeHelp}
          options={options(fields.systemTypeOptions)}
        />
        <SelectField
          form={form}
          name="backup"
          label={fields.backup}
          description={fields.backupHelp}
          options={options(fields.backupOptions)}
        />
        <UnsupportedNotice problems={problems} scheme={scheme} systemType={systemType} />
      </fieldset>

      <FormSubmitButton pending={form.formState.isSubmitting}>{text.submit}</FormSubmitButton>
    </AppForm>
    {result ? (
      <EstimateResults
        preview={result.preview}
        values={result.values}
        stale={stale}
        headingRef={headingRef}
        actions={<SaveEstimate key={result.run} request={result.request} shownVersion={result.preview.config_version} />}
      />
    ) : null}
    </div>
  );
}
