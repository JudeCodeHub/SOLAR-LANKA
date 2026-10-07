"use client";

import { useFieldArray } from "react-hook-form";

import { QuotationLine } from "@/components/company/quotation-line";
import { AppForm } from "@/components/forms/app-form";
import { Button } from "@/components/ui/button";
import { useAppForm } from "@/lib/forms/use-app-form";
import { blankLine, draftSchema, emptyDraft, MAX_LINES } from "@/lib/quotation/draft";
import { messages } from "@/messages";

const text = messages.company.quotation;

/** The line rows of the quotation editor with working add and remove, for the design page; saving does nothing. */
export function QuotationLinesDemo() {
  const form = useAppForm(draftSchema, { defaultValues: { ...emptyDraft, lines: [{ ...blankLine, kind: "charge", description: "Installation", quantity: "1", unit_price: "270000" }, { ...blankLine, kind: "charge", description: "Delivery", quantity: "2", unit_price: "15000" }] } });
  const fields = useFieldArray({ control: form.control, name: "lines" });
  return (
    <div className="max-w-3xl" data-lines-sample>
      <AppForm form={form} onSubmit={() => undefined} className="space-y-4">
        <fieldset className="space-y-4">
          <legend className="sr-only">{text.lines.title}</legend>
          {fields.fields.map((field, index) => (
            <QuotationLine key={field.id} form={form} index={index} lineTotal={index === 0 ? "270000.00" : null} canRemove={fields.fields.length > 1} onRemove={() => fields.remove(index)} />
          ))}
          {fields.fields.length < MAX_LINES ? (
            <Button type="button" variant="outline" onClick={() => fields.append({ ...blankLine })} data-add-line>
              {text.lines.add}
            </Button>
          ) : null}
        </fieldset>
      </AppForm>
    </div>
  );
}
