"use client";

import { AppForm } from "@/components/forms/app-form";
import { FormSubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { FieldDescription } from "@/components/ui/field";
import { useAppForm } from "@/lib/forms/use-app-form";
import { MAX_CLAIM, type OfferFormValues, type OfferValues, offerSchema } from "@/lib/offers/offer";
import { messages } from "@/messages";

const text = messages.company.offers.form;

/** The offer's commercial fields and nothing else. */
export function OfferForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  unsaved,
}: {
  initial: OfferFormValues;
  submitLabel: string;
  onSubmit: (values: OfferValues) => Promise<void>;
  onCancel: () => void;
  unsaved?: boolean;
}) {
  const form = useAppForm(offerSchema, { defaultValues: initial });
  return (
    <AppForm form={form} className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <TextField form={form} name="price" label={text.price} description={text.priceHelp} inputMode="decimal" optional />
        <TextField form={form} name="currency" label={text.currency} description={text.currencyHelp} />
      </div>
      <div className="space-y-1">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="field-check size-6 shrink-0" {...form.register("is_demo_price")} />
          <span>{text.demo}</span>
        </label>
        <FieldDescription>{text.demoHelp}</FieldDescription>
      </div>
      <TextareaField form={form} name="company_claim" label={text.claim} description={text.claimHelp} maxLength={MAX_CLAIM} />
      {unsaved ? <p className="text-sm text-muted-foreground">{text.unsaved}</p> : null}
      <div className="flex flex-wrap gap-2">
        <FormSubmitButton pending={form.formState.isSubmitting}>{submitLabel}</FormSubmitButton>
        <Button type="button" variant="outline" onClick={onCancel}>
          {text.cancel}
        </Button>
      </div>
    </AppForm>
  );
}
