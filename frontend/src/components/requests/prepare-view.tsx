"use client";

import { CircleAlert, Info } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useWatch } from "react-hook-form";

import { ApiErrorMessage } from "@/components/api-error-message";
import { AppForm } from "@/components/forms/app-form";
import { SelectField } from "@/components/forms/select-field";
import { FormSubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { TextField } from "@/components/forms/text-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Field, FieldLabel } from "@/components/ui/field";
import { formatLongDate } from "@/lib/catalogue/detail";
import { DISTRICTS } from "@/lib/directory/options";
import { rangeText } from "@/lib/estimator/format";
import { CHOICES_LIMIT, useEstimateChoices, useSavedEstimate } from "@/lib/estimates/hooks";
import { RecipientsStep } from "@/components/requests/recipients-step";
import { SentConfirmation } from "@/components/requests/sent-confirmation";
import { useAppForm } from "@/lib/forms/use-app-form";
import { useRequestDraft } from "@/lib/requests/draft-store";
import { parseEstimateParam } from "@/lib/requests/prepare";
import {
  MAX_DETAILS,
  type Requirements,
  requirementsDefaults,
  requirementsSchema,
  valuesFromDraft,
} from "@/lib/requests/requirements";
import { format, messages, plural } from "@/messages";

const text = messages.requestPrep;

/** Preparing a quotation request. */
export function PrepareView() {
  const param = parseEstimateParam(useSearchParams().get("estimate"));
  const draft = useRequestDraft((state) => state.draft);
  const setDraft = useRequestDraft((state) => state.setDraft);
  const sent = useRequestDraft((state) => state.sent);
  // The store holds the confirmed requirements.
  const [showForm, setShowForm] = useState(
    () => draft !== null && param.kind === "ok" && param.id !== draft.estimate_id,
  );
  const [editing, setEditing] = useState<Requirements | null>(null);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      {sent ? (
        <SentConfirmation sent={sent} />
      ) : draft && !showForm ? (
        <Ready
          draft={draft}
          onEdit={() => {
            setEditing(draft);
            setShowForm(true);
          }}
        />
      ) : (
        <RequirementsForm
          initial={editing}
          initialEstimateId={param.kind === "ok" ? param.id : ""}
          onConfirm={(requirements) => {
            setDraft(requirements);
            setEditing(null);
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

function RequirementsForm({
  initial,
  initialEstimateId,
  onConfirm,
}: {
  initial: Requirements | null;
  initialEstimateId: string;
  onConfirm: (requirements: Requirements) => void;
}) {
  const form = useAppForm(requirementsSchema, {
    defaultValues: initial
      ? valuesFromDraft(initial)
      : { ...requirementsDefaults, estimate_id: initialEstimateId },
  });
  const choices = useEstimateChoices();
  const selected = useWatch({ control: form.control, name: "estimate_id" });
  const detail = useSavedEstimate(selected, selected !== "");
  // The estimate whose details were last copied into the form, so editing afterwards is not undone.
  const applied = useRef(initial?.estimate_id ?? "");

  useEffect(() => {
    if (selected === "") applied.current = "";
  }, [selected]);

  useEffect(() => {
    const data = detail.data;
    if (selected !== "" && data && data.id === selected && applied.current !== selected) {
      applied.current = selected;
      form.setValue("district", data.inputs.district, { shouldValidate: true });
      form.setValue("monthly_consumption_kwh", String(data.inputs.monthly_consumption_kwh), {
        shouldValidate: true,
      });
    }
  }, [detail.data, selected, form]);

  // Not one of the customer's estimates (or gone): never keep it selected.
  const refused = detail.isError && (detail.error.status === 404 || detail.error.status === 422);
  useEffect(() => {
    if (refused) {
      form.setValue("estimate_id", "");
      form.setError("estimate_id", { type: "unavailable", message: text.estimate.unavailable });
    }
  }, [refused, form]);

  const items = choices.data?.items ?? [];
  const extra =
    detail.data && selected === detail.data.id && !items.some((item) => item.id === detail.data.id)
      ? detail.data
      : null;
  const locked = selected !== "" && detail.data?.id === selected ? detail.data.inputs.district : null;
  const estimateError = form.formState.errors.estimate_id?.message;
  // Choosing anything clears a message about an earlier choice.
  const radio = (value: string) => {
    const field = form.register("estimate_id");
    return {
      ...field,
      value,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        form.clearErrors("estimate_id");
        return field.onChange(event);
      },
    };
  };

  const option = (id: string, capacity: string, panels: string, count: number, saved: string, version: number) => {
    const size = format(plural(text.estimate.size, count), { capacity, panels });
    return {
      id,
      label: format(text.estimate.option, { size, date: formatLongDate(saved) ?? saved, version }),
    };
  };
  const options = [
    ...items.map((item) =>
      option(
        item.id,
        rangeText(item.capacity_kwp_minimum, item.capacity_kwp_maximum),
        rangeText(item.panel_count_minimum, item.panel_count_maximum),
        item.panel_count_maximum,
        item.created_at,
        item.config_version,
      ),
    ),
    ...(extra
      ? [
          option(
            extra.id,
            rangeText(extra.estimate.sizing.capacity_kwp.minimum, extra.estimate.sizing.capacity_kwp.maximum),
            rangeText(extra.estimate.sizing.panel_count.minimum, extra.estimate.sizing.panel_count.maximum),
            extra.estimate.sizing.panel_count.maximum,
            extra.created_at,
            extra.configuration.version,
          ),
        ]
      : []),
  ];

  // Only customers prepare requests.
  if (choices.isError && choices.error.status === 403) {
    return <ApiErrorMessage error={choices.error} />;
  }

  return (
    <AppForm
      form={form}
      className="space-y-6"
      onSubmit={(requirements) => {
        // An estimate is only attached once the API has confirmed it is the customer's own.
        if (requirements.estimate_id !== null && detail.data?.id !== requirements.estimate_id) {
          form.setError("estimate_id", { type: "server", message: text.estimate.loadingDetails });
          return;
        }
        onConfirm(requirements);
      }}
    >
      <fieldset className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" aria-describedby="estimate-help" data-section="estimate">
        <legend className="type-subheading float-left mb-4 flex w-full items-center gap-3 text-ink">
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-orange-tint text-orange-text type-figure">{1}</span>
          {text.estimate.legend}
        </legend>
        <p id="estimate-help" className="type-small text-ink-2">
          {text.estimate.help}
        </p>
        {choices.isPending ? (
          <p role="status" className="type-small text-ink-2">
            {text.estimate.loading}
          </p>
        ) : choices.isError ? (
          <ApiErrorMessage error={choices.error} onRetry={() => void choices.refetch()} retrying={choices.isRefetching} />
        ) : (
          <>
            <ul className="space-y-2">
              <li>
                <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-field border border-line bg-paper p-3 text-sm text-ink has-[:checked]:border-orange-text has-[:checked]:bg-orange-tint">
                  <input type="radio" className="field-radio mt-1 size-6 shrink-0" {...radio("")} />
                  <span>{text.estimate.none}</span>
                </label>
              </li>
              {options.map((entry) => (
                <li key={entry.id}>
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-field border border-line bg-paper p-3 text-sm text-ink has-[:checked]:border-orange-text has-[:checked]:bg-orange-tint">
                    <input type="radio" className="field-radio mt-1 size-6 shrink-0" {...radio(entry.id)} />
                    <span>{entry.label}</span>
                  </label>
                </li>
              ))}
            </ul>
            {items.length === 0 && !extra ? (
              <p className="type-small text-ink-2">
                {text.estimate.emptyList}{" "}
                <Link href="/estimator" className="font-medium text-orange-text underline underline-offset-2">
                  {text.estimate.calculate}
                </Link>
              </p>
            ) : null}
            {(choices.data?.total ?? 0) > CHOICES_LIMIT ? (
              <p className="type-small text-ink-2">{format(text.estimate.more, { max: CHOICES_LIMIT })}</p>
            ) : null}
          </>
        )}
        {selected !== "" && detail.isPending ? (
          <p role="status" className="type-small text-ink-2">
            {text.estimate.loadingDetails}
          </p>
        ) : null}
        {selected !== "" && detail.isError && !refused ? (
          <ApiErrorMessage error={detail.error} onRetry={() => void detail.refetch()} retrying={detail.isRefetching} />
        ) : null}
        {detail.data && selected === detail.data.id ? (
          <p role="status" className="type-small text-ink-2" data-filled>
            {format(text.estimate.filledFrom, {
              district: detail.data.inputs.district,
              consumption: String(detail.data.inputs.monthly_consumption_kwh),
            })}{" "}
            <Link href={`/my/estimates/${detail.data.id}`} className="font-medium text-orange-text underline underline-offset-2">
              {text.estimate.view}
            </Link>
          </p>
        ) : null}
        {estimateError ? (
          <p className="flex items-center gap-2 text-sm font-medium text-danger" data-estimate-error>
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {estimateError}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" data-section="requirements">
        <legend className="type-subheading float-left mb-4 flex w-full items-center gap-3 text-ink">
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-orange-tint text-orange-text type-figure">{2}</span>
          {text.fields.title}
        </legend>
        {locked !== null ? (
          <Field>
            <FieldLabel>{text.fields.district}</FieldLabel>
            <p className="text-sm" data-locked-district>
              {format(text.fields.districtLocked, { district: locked })}
            </p>
          </Field>
        ) : (
          <SelectField
            form={form}
            name="district"
            label={text.fields.district}
            description={text.fields.districtHelp}
            placeholder={text.fields.districtPlaceholder}
            options={DISTRICTS.map((district) => ({ value: district, label: district }))}
          />
        )}
        <TextField
          form={form}
          name="monthly_consumption_kwh"
          label={text.fields.consumption}
          description={text.fields.consumptionHelp}
          inputMode="decimal"
          optional
        />
        <TextareaField
          form={form}
          name="details"
          label={text.fields.details}
          description={text.fields.detailsHelp}
          maxLength={MAX_DETAILS}
        />
      </fieldset>

      <FormSubmitButton pending={form.formState.isSubmitting}>{text.continue}</FormSubmitButton>
    </AppForm>
  );
}

function Ready({ draft, onEdit }: { draft: Requirements; onEdit: () => void }) {
  const ready = text.ready;
  return (
    <>
      <section aria-labelledby="ready-title" className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6">
        <h2 id="ready-title" className="type-heading text-ink">
          {ready.title}
        </h2>
        <p className="type-small text-ink-2">{ready.intro}</p>
        <dl className="description-list text-sm" data-ready>
          <dt className="text-ink-2">{ready.district}</dt>
          <dd>{draft.district}</dd>
          <dt className="text-ink-2">{ready.consumption}</dt>
          <dd>
            {draft.monthly_consumption_kwh === null
              ? ready.unknown
              : format(ready.consumptionValue, { value: draft.monthly_consumption_kwh })}
          </dd>
          <dt className="text-ink-2">{ready.estimate}</dt>
          <dd>
            {draft.estimate_id === null ? (
              ready.estimateNone
            ) : (
              <>
                {ready.estimateValue}{" "}
                <Link href={`/my/estimates/${draft.estimate_id}`} className="font-medium text-orange-text underline underline-offset-2">
                  {text.estimate.view}
                </Link>
              </>
            )}
          </dd>
          <dt className="text-ink-2">{ready.details}</dt>
          <dd className="whitespace-pre-wrap">{draft.details}</dd>
        </dl>
        <Button type="button" variant="outline" onClick={onEdit}>
          {ready.edit}
        </Button>
      </section>
      <Alert variant="info" role="note" data-nothing-sent>
        <Info aria-hidden />
        <AlertDescription>{text.nothingSent}</AlertDescription>
      </Alert>
      <RecipientsStep requirements={draft} />
    </>
  );
}

