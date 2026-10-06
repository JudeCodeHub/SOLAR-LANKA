"use client";

import { Check } from "lucide-react";
import { useEffect } from "react";
import { type FieldValues, get, type Path, type UseFormReturn } from "react-hook-form";

import { useAppFormContext } from "@/components/forms/app-form";
import { FieldDescription, FieldError } from "@/components/ui/field";
import { fieldId } from "@/lib/forms/errors";
import { cn } from "@/lib/utils";

export interface RadioCard {
  value: string;
  title: string;
  /** One line saying what the choice means. */
  line: string;
  /** A short tag such as "Supported". */
  tag?: string;
}

/** One labelled choice shown as large cards: a native radio group, so arrow keys, the group's name and the chosen state all come from the browser. */
export function RadioCardsField<TInput extends FieldValues, TOutput extends FieldValues = TInput>({
  form,
  name,
  label,
  description,
  cards,
}: {
  form: UseFormReturn<TInput, unknown, TOutput>;
  name: Path<TInput>;
  label: string;
  description?: string;
  cards: readonly RadioCard[];
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
  const describedBy = [description ? descriptionId : null, hasError ? errorId : null].filter(Boolean).join(" ");

  return (
    <fieldset className="space-y-3" data-invalid={hasError} data-radio-cards={name}>
      <legend className="text-sm font-medium text-ink">{label}</legend>
      <div role="radiogroup" aria-label={label} aria-invalid={hasError} aria-describedby={describedBy || undefined} className="grid gap-3 sm:grid-cols-2">
        {cards.map((card, index) => (
          <label
            key={card.value}
            className={cn(
              "relative flex min-h-24 cursor-pointer flex-col gap-1 rounded-card border border-field-border bg-surface p-4 pr-11 transition-colors hover:border-orange motion-reduce:transition-none",
              "has-[:checked]:border-2 has-[:checked]:border-orange has-[:checked]:bg-orange-tint",
              "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
              // An error belongs to the chosen card, not to the others.
              hasError && "has-[:checked]:border-danger has-[:checked]:bg-danger-tint",
            )}
          >
            <input
              type="radio"
              value={card.value}
              id={index === 0 ? id : undefined}
              className="peer sr-only"
              {...form.register(name)}
            />
            <span className="type-small font-semibold text-ink">{card.title}</span>
            <span className="type-small text-ink-2">{card.line}</span>
            {card.tag ? <span className="type-caption mt-auto pt-1 font-semibold tracking-wide text-ink-3 uppercase">{card.tag}</span> : null}
            <span aria-hidden className="absolute top-3 right-3 grid size-6 place-items-center rounded-full border border-field-border bg-surface text-transparent peer-checked:border-orange peer-checked:bg-orange peer-checked:text-on-orange">
              <Check className="size-4" />
            </span>
          </label>
        ))}
      </div>
      {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
      {hasError ? (
        <FieldError id={errorId} role={undefined}>
          {error?.message}
        </FieldError>
      ) : null}
    </fieldset>
  );
}
