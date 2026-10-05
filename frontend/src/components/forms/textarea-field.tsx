"use client";

import { useEffect } from "react";
import { type FieldValues, get, type Path, type UseFormReturn, useWatch } from "react-hook-form";

import { useAppFormContext } from "@/components/forms/app-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { fieldId } from "@/lib/forms/errors";
import { format, messages } from "@/messages";

const areaClass = "field-control min-h-28 w-full min-w-0 px-3.5 py-3";

/** A labelled multi-line field wired like TextField. */
export function TextareaField<TInput extends FieldValues, TOutput extends FieldValues = TInput>({
  form,
  name,
  label,
  description,
  maxLength,
  rows = 5,
}: {
  form: UseFormReturn<TInput, unknown, TOutput>;
  name: Path<TInput>;
  label: string;
  description?: string;
  maxLength: number;
  rows?: number;
}) {
  const { formId, labels } = useAppFormContext();
  useEffect(() => {
    labels.set(name, label);
    return () => {
      labels.delete(name);
    };
  }, [labels, name, label]);

  const value = useWatch({ control: form.control, name }) as string | undefined;
  const id = fieldId(formId, name);
  const descriptionId = `${id}-description`;
  const countId = `${id}-count`;
  const errorId = `${id}-error`;
  const error = get(form.formState.errors, name) as { message?: string } | undefined;
  const hasError = Boolean(error?.message);
  const describedBy = [description ? descriptionId : null, countId, hasError ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <Field data-invalid={hasError}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <textarea
        id={id}
        rows={rows}
        aria-required
        aria-invalid={hasError}
        aria-describedby={describedBy}
        className={areaClass}
        {...form.register(name)}
      />
      {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
      <p id={countId} className="text-xs text-muted-foreground">
        {format(messages.forms.characterCount, { count: (value ?? "").length, max: maxLength })}
      </p>
      {hasError ? (
        <FieldError id={errorId} role={undefined}>
          {error?.message}
        </FieldError>
      ) : null}
    </Field>
  );
}
