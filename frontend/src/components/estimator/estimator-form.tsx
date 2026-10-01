"use client";

import { useEffect, useRef, useState } from "react";
import { useWatch } from "react-hook-form";

import { EstimateResults, type SubmittedValues } from "@/components/estimator/estimate-results";
import { UnsupportedNotice } from "@/components/estimator/unsupported-notice";
import { AppForm } from "@/components/forms/app-form";
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

const options = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

/**
 * The estimator input form. Required and optional fields are told apart in words, the supported
 * scenario is pre-selected and spelled out, and choosing an unsupported scheme, system type or
 * backup explains it at once and refuses to submit, so an unsupported request is never sent.
 */
export function EstimatorForm() {
  const form = useAppForm(estimatorSchema, { defaultValues: { ...estimatorDefaults } });
  const [result, setResult] = useState<{ preview: Preview; values: SubmittedValues } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
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
        setResult({
          preview,
          values: {
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
      <fieldset className="space-y-4">
        <legend className="font-heading text-lg font-semibold tracking-tight">
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

      <fieldset className="space-y-4">
        <legend className="font-heading text-lg font-semibold tracking-tight">
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

      <fieldset className="space-y-4">
        <legend className="font-heading text-lg font-semibold tracking-tight">
          {text.sections.scenario}
        </legend>
        <SelectField
          form={form}
          name="connection_scheme"
          label={fields.scheme}
          description={fields.schemeHelp}
          options={options(fields.schemeOptions)}
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
      />
    ) : null}
    </div>
  );
}
