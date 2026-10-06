"use client";

import { useEffect } from "react";
import { type FieldValues, get, type Path, type UseFormReturn } from "react-hook-form";

import { useAppFormContext } from "@/components/forms/app-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { fieldId } from "@/lib/forms/errors";
import { messages } from "@/messages";

const selectClass = "field-control field-select h-11 w-full min-w-0 px-3.5 py-2";

/** A labelled native select wired like TextField: label, description, error and aria state. */
export function SelectField<TInput extends FieldValues, TOutput extends FieldValues = TInput>({
  form,
  name,
  label,
  description,
  options,
  placeholder,
  optional = false,
}: {
  form: UseFormReturn<TInput, unknown, TOutput>;
  name: Path<TInput>;
  label: string;
  description?: string;
  options: readonly { value: string; label: string }[];
  /** Label of the empty choice. Omit when a value is always chosen. */
  placeholder?: string;
  optional?: boolean;
}) {
  const { formId, labels } = useAppFormContext();
  useEffect(() => {
    labels.set(name, label);
    return () => {
      labels.delete(name);
    };
  }, [labels, name, label]);

  const id = fieldId(formId, name);
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const error = get(form.formState.errors, name) as { message?: string } | undefined;
  const hasError = Boolean(error?.message);
  const describedBy = [description ? descriptionId : null, hasError ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <Field data-invalid={hasError}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional ? (
          <span className="font-normal text-ink-3">{messages.forms.optionalMarker}</span>
        ) : null}
      </FieldLabel>
      <select
        id={id}
        aria-required={!optional}
        aria-invalid={hasError}
        aria-describedby={describedBy || undefined}
        className={selectClass}
        {...form.register(name)}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
      {hasError ? (
        <FieldError id={errorId} role={undefined}>
          {error?.message}
        </FieldError>
      ) : null}
    </Field>
  );
}
