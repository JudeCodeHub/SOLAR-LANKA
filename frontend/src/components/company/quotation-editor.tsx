"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useFieldArray, useWatch } from "react-hook-form";

import { ApiErrorMessage } from "@/components/api-error-message";
import { QuotationLine } from "@/components/company/quotation-line";
import { StaffGate } from "@/components/company/staff-gate";
import { AppForm } from "@/components/forms/app-form";
import { SelectField } from "@/components/forms/select-field";
import { FormSubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { TextField } from "@/components/forms/text-field";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api/errors";
import { useEnquiry } from "@/lib/inbox/hooks";
import { isActive } from "@/lib/inbox/inbox";
import { useAppForm } from "@/lib/forms/use-app-form";
import {
  blankLine,
  type DraftValues,
  draftSchema,
  formatMoney,
  isDirty,
  MAX_LINES,
  missingForSending,
  valuesFromTerms,
} from "@/lib/quotation/draft";
import { type CurrentQuotation, useCurrentQuotation, useSaveDraft, useStartDraft } from "@/lib/quotation/hooks";
import { format, messages } from "@/messages";

const text = messages.company.quotation;
const statusNames: Record<string, string> = text.section.statuses;

/** The quotation draft page; the company comes from the person's own memberships. */
export function QuotationDraftView({ id }: { id: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <StaffGate basePath={`/company/inbox/${id}/quotation`}>
        {(company) => (
          <>
            <Link href={`/company/inbox/${id}?company=${company.company_id}`} className="text-sm underline underline-offset-2">
              {text.editor.back}
            </Link>
            <Draft companyId={company.company_id} deliveryId={id} />
          </>
        )}
      </StaffGate>
    </div>
  );
}

function Draft({ companyId, deliveryId }: { companyId: string; deliveryId: string }) {
  const query = useCurrentQuotation(companyId, deliveryId);
  const start = useStartDraft(companyId, deliveryId);
  // Once the editor has been open, it stays on screen (locked) so typed input is never lost.
  const [locked, setLocked] = useState(false);
  // Synchronous guard: React state is too slow to stop several clicks in the same moment.
  const starting = useRef(false);
  return (
    <>
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.editor.title}</h1>
        <p className="text-sm text-muted-foreground" data-draft-note>
          {text.editor.draftNote}
        </p>
      </header>
      <QueryState query={query}>
        {(current) =>
          current === null ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{text.editor.none}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (starting.current) return;
                  starting.current = true;
                  start.mutate(undefined, { onSettled: () => { starting.current = false; } });
                }}
                aria-disabled={start.isPending}
              >
                {text.editor.start}
              </Button>
            </div>
          ) : current.status !== "draft" && !locked ? (
            <p className="text-sm" data-not-draft>
              {format(text.editor.notDraft, { status: statusNames[current.status] ?? current.status })}
            </p>
          ) : (
            <Editor
              companyId={companyId}
              deliveryId={deliveryId}
              current={current}
              refetch={query.refetch}
              locked={current.status !== "draft"}
              onLock={() => setLocked(true)}
            />
          )
        }
      </QueryState>
    </>
  );
}

function Editor({
  companyId,
  deliveryId,
  current,
  refetch,
  locked,
  onLock,
}: {
  companyId: string;
  deliveryId: string;
  current: CurrentQuotation;
  refetch: () => Promise<{ data?: CurrentQuotation | null }>;
  /** True once the quotation is no longer a draft: the typed input stays visible but cannot be saved. */
  locked: boolean;
  onLock: () => void;
}) {
  const form = useAppForm(draftSchema, { defaultValues: valuesFromTerms(current.terms) });
  const fields = useFieldArray({ control: form.control, name: "lines" });
  const values = useWatch({ control: form.control }) as DraftValues;
  const save = useSaveDraft(companyId, deliveryId, current.quotation_id);
  const enquiry = useEnquiry(companyId, deliveryId);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<ApiError | null>(null);
  // Synchronous guard: React state is too slow to stop two clicks in the same moment.
  const inFlight = useRef(false);

  const terms = current.terms;
  const dirty = isDirty(terms, values);
  const inactive = (enquiry.data ? !isActive(enquiry.data) : false) || locked;
  const inactiveReason = enquiry.data?.status === "cancelled" ? "withdrawn" : enquiry.data?.status === "closed" ? "closed" : "other";
  const missing = missingForSending(terms);
  const totals: [string, string | null][] = [
    [text.totals.subtotal, terms.subtotal],
    [text.totals.discount, terms.discount],
    [text.totals.tax, terms.tax],
    [text.totals.total, terms.total],
  ];

  return (
    <>
      {locked ? (
        <p role="status" className="text-sm font-medium" data-locked>
          {format(text.editor.notDraft, { status: statusNames[current.status] ?? current.status })}
        </p>
      ) : inactive ? (
        <p role="status" className="text-sm font-medium" data-inactive>
          {text.editor.inactive[inactiveReason]}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-sm font-medium" data-message>
          {message}
        </p>
      ) : null}
      {notice ? (
        <p role="alert" className="text-sm font-medium" data-stale-notice>
          {notice}
        </p>
      ) : null}
      {problem ? <ApiErrorMessage error={problem} /> : null}

      <AppForm
        form={form}
        className="space-y-8"
        onSubmit={async (payload) => {
          // aria-disabled does not stop a click: refuse here when the enquiry is no longer active.
          if (inFlight.current || inactive) return;
          inFlight.current = true;
          setMessage(null);
          setNotice(null);
          setProblem(null);
          try {
            await save.mutateAsync(payload);
            const fresh = (await refetch()).data;
            if (fresh) form.reset(valuesFromTerms(fresh.terms));
            setMessage(text.saved);
          } catch (error) {
            const failure = error as ApiError;
            if (failure.status === 409) {
              // The draft or the enquiry moved on: read both again, keep the typed input, and say so.
              const fresh = (await refetch()).data;
              void enquiry.refetch();
              if (fresh && fresh.status !== "draft") onLock();
              setNotice(fresh && fresh.status !== "draft" ? text.stale.notDraft : text.stale.inactive);
              return;
            }
            throw error;
          } finally {
            inFlight.current = false;
          }
        }}
      >
        <fieldset className="space-y-4">
          <legend className="font-heading text-xl font-semibold tracking-tight">{text.lines.title}</legend>
          <p className="text-sm text-muted-foreground">{text.lines.intro}</p>
          {fields.fields.map((field, index) => (
            <QuotationLine
              key={field.id}
              form={form}
              index={index}
              lineTotal={terms.lines[index]?.line_total}
              canRemove={fields.fields.length > 1}
              onRemove={() => fields.remove(index)}
            />
          ))}
          {fields.fields.length < MAX_LINES ? (
            <Button type="button" variant="outline" size="sm" onClick={() => fields.append({ ...blankLine })}>
              {text.lines.add}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{format(text.lines.limit, { max: MAX_LINES })}</p>
          )}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-heading text-xl font-semibold tracking-tight">{text.pricing.title}</legend>
          <SelectField
            form={form}
            name="discount_kind"
            label={text.pricing.discountKind}
            options={[
              { value: "none", label: text.pricing.discountKinds.none },
              { value: "fixed", label: text.pricing.discountKinds.fixed },
              { value: "percent", label: text.pricing.discountKinds.percent },
            ]}
          />
          {values.discount_kind !== "none" ? (
            <TextField form={form} name="discount_value" label={text.pricing.discountValue} description={text.pricing.discountValueHelp} inputMode="decimal" />
          ) : null}
          <TextField form={form} name="tax_rate_percent" label={text.pricing.tax} description={text.pricing.taxHelp} inputMode="decimal" optional />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-heading text-xl font-semibold tracking-tight">{text.terms.title}</legend>
          <TextField form={form} name="capacity_kwp" label={text.terms.capacity} inputMode="decimal" optional />
          <TextareaField form={form} name="warranty_terms" label={text.terms.warranty} maxLength={2000} />
          <TextareaField form={form} name="exclusions" label={text.terms.exclusions} description={text.terms.exclusionsHelp} maxLength={2000} />
          <TextField form={form} name="validity_days" label={text.terms.validity} description={text.terms.validityHelp} inputMode="numeric" optional />
          <TextareaField form={form} name="notes" label={text.terms.notes} description={text.terms.notesHelp} maxLength={4000} />
        </fieldset>

        {dirty ? (
          <p className="text-sm text-muted-foreground" data-unsaved>
            {text.unsaved}
          </p>
        ) : null}
        <FormSubmitButton pending={form.formState.isSubmitting}>{text.save}</FormSubmitButton>
      </AppForm>

      <section aria-labelledby="totals-title" className="space-y-3 rounded-lg border p-4" data-totals>
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="totals-title" className="font-heading text-xl font-semibold tracking-tight">
            {text.totals.title}
          </h2>
          <span className="rounded-full border px-2 py-0.5 text-xs" data-badge="server">
            {text.totals.badge}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{text.totals.intro}</p>
        {terms.total === null ? (
          <p className="text-sm" data-no-totals>
            {text.totals.none}
          </p>
        ) : (
          <>
            {dirty ? (
              <p className="text-sm font-medium" data-totals-stale>
                {text.totals.stale}
              </p>
            ) : null}
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
              {totals.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className={label === text.totals.total ? "font-medium" : undefined} data-total={label}>
                    {formatMoney(value) ?? ""}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </section>

      <section aria-labelledby="checklist-title" className="space-y-2">
        <h2 id="checklist-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.checklist.title}
        </h2>
        {missing.length === 0 ? (
          <p className="text-sm" data-ready>
            {text.checklist.done}
          </p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm" data-missing>
            {missing.map((key) => (
              <li key={key}>{text.checklist[key]}</li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
