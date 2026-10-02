"use client";

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
import { Button } from "@/components/ui/button";
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
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
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
      className="space-y-8"
      onSubmit={(requirements) => {
        // An estimate is only attached once the API has confirmed it is the customer's own.
        if (requirements.estimate_id !== null && detail.data?.id !== requirements.estimate_id) {
          form.setError("estimate_id", { type: "server", message: text.estimate.loadingDetails });
          return;
        }
        onConfirm(requirements);
      }}
    >
      <fieldset className="space-y-3" aria-describedby="estimate-help">
        <legend className="font-heading text-lg font-semibold tracking-tight">{text.estimate.legend}</legend>
        <p id="estimate-help" className="text-sm text-muted-foreground">
          {text.estimate.help}
        </p>
        {choices.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            {text.estimate.loading}
          </p>
        ) : choices.isError ? (
          <ApiErrorMessage error={choices.error} onRetry={() => void choices.refetch()} retrying={choices.isRefetching} />
        ) : (
          <>
            <ul className="space-y-1">
              <li>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input type="radio" className="mt-1 size-6 shrink-0" {...radio("")} />
                  <span>{text.estimate.none}</span>
                </label>
              </li>
              {options.map((entry) => (
                <li key={entry.id}>
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input type="radio" className="mt-1 size-6 shrink-0" {...radio(entry.id)} />
                    <span>{entry.label}</span>
                  </label>
                </li>
              ))}
            </ul>
            {items.length === 0 && !extra ? (
              <p className="text-sm text-muted-foreground">
                {text.estimate.emptyList}{" "}
                <Link href="/estimator" className="underline underline-offset-2">
                  {text.estimate.calculate}
                </Link>
              </p>
            ) : null}
            {(choices.data?.total ?? 0) > CHOICES_LIMIT ? (
              <p className="text-sm text-muted-foreground">{format(text.estimate.more, { max: CHOICES_LIMIT })}</p>
            ) : null}
          </>
        )}
        {selected !== "" && detail.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            {text.estimate.loadingDetails}
          </p>
        ) : null}
        {selected !== "" && detail.isError && !refused ? (
          <ApiErrorMessage error={detail.error} onRetry={() => void detail.refetch()} retrying={detail.isRefetching} />
        ) : null}
        {detail.data && selected === detail.data.id ? (
          <p role="status" className="text-sm text-muted-foreground" data-filled>
            {format(text.estimate.filledFrom, {
              district: detail.data.inputs.district,
              consumption: String(detail.data.inputs.monthly_consumption_kwh),
            })}{" "}
            <Link href={`/my/estimates/${detail.data.id}`} className="underline underline-offset-2">
              {text.estimate.view}
            </Link>
          </p>
        ) : null}
        {estimateError ? (
          <p className="text-sm text-destructive" data-estimate-error>
            {estimateError}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-heading text-lg font-semibold tracking-tight">{text.fields.title}</legend>
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
      <section aria-labelledby="ready-title" className="space-y-3">
        <h2 id="ready-title" className="font-heading text-xl font-semibold tracking-tight">
          {ready.title}
        </h2>
        <p className="text-sm text-muted-foreground">{ready.intro}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm" data-ready>
          <dt className="text-muted-foreground">{ready.district}</dt>
          <dd>{draft.district}</dd>
          <dt className="text-muted-foreground">{ready.consumption}</dt>
          <dd>
            {draft.monthly_consumption_kwh === null
              ? ready.unknown
              : format(ready.consumptionValue, { value: draft.monthly_consumption_kwh })}
          </dd>
          <dt className="text-muted-foreground">{ready.estimate}</dt>
          <dd>
            {draft.estimate_id === null ? (
              ready.estimateNone
            ) : (
              <>
                {ready.estimateValue}{" "}
                <Link href={`/my/estimates/${draft.estimate_id}`} className="underline underline-offset-2">
                  {text.estimate.view}
                </Link>
              </>
            )}
          </dd>
          <dt className="text-muted-foreground">{ready.details}</dt>
          <dd className="whitespace-pre-wrap">{draft.details}</dd>
        </dl>
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          {ready.edit}
        </Button>
      </section>
      <p className="text-sm font-medium" data-nothing-sent>
        {text.nothingSent}
      </p>
      <RecipientsStep requirements={draft} />
    </>
  );
}

