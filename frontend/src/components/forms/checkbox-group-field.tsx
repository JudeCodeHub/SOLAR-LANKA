"use client";

import { useEffect } from "react";
import { type FieldValues, get, type Path, type UseFormReturn } from "react-hook-form";

import { useAppFormContext } from "@/components/forms/app-form";
import { FieldDescription, FieldError } from "@/components/ui/field";
import { fieldId } from "@/lib/forms/errors";

/** A group of checkboxes for choosing several values, as one labelled fieldset. */
export function CheckboxGroupField<TInput extends FieldValues, TOutput extends FieldValues = TInput>({
  form,
  name,
  legend,
  description,
  options,
  columns = "sm:grid-cols-2",
}: {
  form: UseFormReturn<TInput, unknown, TOutput>;
  name: Path<TInput>;
  legend: string;
  description?: string;
  options: readonly { value: string; label: string }[];
  columns?: string;
}) {
  const { formId, labels } = useAppFormContext();
  useEffect(() => {
    labels.set(name, legend);
    return () => {
      labels.delete(name);
    };
  }, [labels, name, legend]);

  const id = fieldId(formId, name);
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const error = get(form.formState.errors, name) as { message?: string } | undefined;
  const hasError = Boolean(error?.message);
  const describedBy = [description ? descriptionId : null, hasError ? errorId : null].filter(Boolean).join(" ");

  return (
    <fieldset id={id} className="space-y-2" aria-describedby={describedBy || undefined} aria-invalid={hasError}>
      <legend className="text-sm font-medium">{legend}</legend>
      {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
      <ul className={`grid gap-x-4 gap-y-1 ${columns}`}>
        {options.map((option) => (
          <li key={option.value}>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="size-6 shrink-0" value={option.value} {...form.register(name)} />
              <span>{option.label}</span>
            </label>
          </li>
        ))}
      </ul>
      {hasError ? (
        <FieldError id={errorId} role={undefined}>
          {error?.message}
        </FieldError>
      ) : null}
    </fieldset>
  );
}
