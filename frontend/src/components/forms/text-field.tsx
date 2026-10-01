"use client";

import { useEffect } from "react";
import { type FieldValues, get, type Path, type UseFormReturn } from "react-hook-form";

import { useAppFormContext } from "@/components/forms/app-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { fieldId } from "@/lib/forms/errors";
import { messages } from "@/messages";

/** A labelled text input wired for accessibility. */
export function TextField<TInput extends FieldValues, TOutput extends FieldValues = TInput>({
  form,
  name,
  label,
  description,
  optional = false,
  type = "text",
  autoComplete,
  inputMode,
  placeholder,
  disabled,
}: {
  form: UseFormReturn<TInput, unknown, TOutput>;
  name: Path<TInput>;
  label: string;
  description?: string;
  optional?: boolean;
  type?: "text" | "email" | "password" | "tel" | "number" | "url";
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "decimal" | "email" | "tel" | "url";
  placeholder?: string;
  disabled?: boolean;
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
          <span className="font-normal text-muted-foreground">{messages.forms.optionalMarker}</span>
        ) : null}
      </FieldLabel>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        disabled={disabled}
        aria-required={!optional}
        aria-invalid={hasError}
        aria-describedby={describedBy || undefined}
        {...form.register(name)}
      />
      {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
      {/* The summary announces errors after a submit; here the error is read with the field. */}
      {hasError ? (
        <FieldError id={errorId} role={undefined}>
          {error?.message}
        </FieldError>
      ) : null}
    </Field>
  );
}
