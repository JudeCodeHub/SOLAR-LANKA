"use client";

import { BackLink } from "@/components/ui/back-link";
import { CircleCheck, Lock, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { useFieldArray, useWatch } from "react-hook-form";

import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { TotalsPanel } from "@/components/company/quotation-totals";
import { QuotationLine } from "@/components/company/quotation-line";
import { RevisionBody, RevisionHistory } from "@/components/company/quotation-revision";
import { StaffGate } from "@/components/company/staff-gate";
import { AppForm } from "@/components/forms/app-form";
import { SelectField } from "@/components/forms/select-field";
import { FormSubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { TextField } from "@/components/forms/text-field";
import { QueryState } from "@/components/query-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { ApiError } from "@/lib/api/errors";
import { formatLongDate } from "@/lib/catalogue/detail";
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
import { type CurrentQuotation, type Revision, useCurrentQuotation, useQuotationActions, useRevisions, useSaveDraft, useStartDraft } from "@/lib/quotation/hooks";
import { actionsFor, explain, type LifecycleActions, staleMessage, statusLabel, type Workspace as WorkspaceState, workspaceState } from "@/lib/quotation/lifecycle";
import { format, messages } from "@/messages";

const text = messages.company.quotation;
const life = text.lifecycle;
const statusNames: Record<string, string> = text.section.statuses;

type Perform = (fn: () => Promise<unknown>, success: string | ((result: never) => string)) => Promise<void>;

/** The quotation page: the draft editor, the frozen sent revision, the actions between them, and the history. */
export function QuotationDraftView({ id }: { id: string }) {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
      <StaffGate basePath={`/company/inbox/${id}/quotation`}>
        {(company) => (
          <>
            <BackLink href={`/company/inbox/${id}?company=${company.company_id}`}>{text.editor.back}</BackLink>
            <Quotation companyId={company.company_id} deliveryId={id} />
          </>
        )}
      </StaffGate>
    </div>
  );
}

function Quotation({ companyId, deliveryId }: { companyId: string; deliveryId: string }) {
  const query = useCurrentQuotation(companyId, deliveryId);
  const start = useStartDraft(companyId, deliveryId);
  // Synchronous guard: React state is too slow to stop several clicks in the same moment.
  const starting = useRef(false);
  return (
    <>
      <PageHeader eyebrow={text.editor.eyebrow} title={text.editor.title} />
      <QueryState query={query}>
        {(current) =>
          current === null ? (
            <div className="space-y-2">
              <p className="type-body text-ink-2">{text.editor.none}</p>
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
          ) : (
            <Workspace companyId={companyId} deliveryId={deliveryId} current={current} refetchCurrent={query.refetch} />
          )
        }
      </QueryState>
    </>
  );
}

function Workspace({
  companyId,
  deliveryId,
  current,
  refetchCurrent,
}: {
  companyId: string;
  deliveryId: string;
  current: CurrentQuotation;
  refetchCurrent: () => Promise<{ data?: CurrentQuotation | null }>;
}) {
  const revisions = useRevisions(companyId, deliveryId, current.quotation_id);
  const enquiry = useEnquiry(companyId, deliveryId);
  const actions = useQuotationActions(companyId, deliveryId, current.quotation_id);
  const [banner, setBanner] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<ApiError | null>(null);
  // Once the editor has been open, it stays on screen (locked) so typed input is never lost.
  const [keepEditor, setKeepEditor] = useState(false);
  // Synchronous guard: React state is too slow to stop several clicks in the same moment.
  const inFlight = useRef(false);

  const refreshAll = async (): Promise<{ items: Revision[]; at: number; enquiryStatus: string | undefined }> => {
    const [, fresh, asked] = await Promise.all([refetchCurrent(), revisions.refetch(), enquiry.refetch()]);
    return { items: fresh.data?.items ?? [], at: fresh.dataUpdatedAt, enquiryStatus: asked.data?.status };
  };

  const perform: Perform = async (fn, success) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBanner(null);
    setNotice(null);
    setProblem(null);
    try {
      const result = await fn();
      await refreshAll();
      setBanner(typeof success === "function" ? success(result as never) : success);
    } catch (error) {
      const failure = error as ApiError;
      if (failure.status === 409) {
        // The quotation moved on since this page loaded: read it again and say what it is now.
        const fresh = await refreshAll();
        const closed = fresh.enquiryStatus === "closed" || fresh.enquiryStatus === "cancelled";
        // If the whole enquiry ended meanwhile, say that rather than describing the quotation.
        setNotice(
          closed
            ? text.editor.inactive[fresh.enquiryStatus === "cancelled" ? "withdrawn" : "closed"]
            : staleMessage(workspaceState(fresh.items, fresh.at)),
        );
      } else {
        setProblem(failure);
      }
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <QueryState query={revisions}>
      {(page) => {
        const items = page.items;
        const now = revisions.dataUpdatedAt;
        const state = workspaceState(items, now);
        const active = enquiry.data ? isActive(enquiry.data) : true;
        const acts = actionsFor(state, active);
        const view = (id: string) => items.find((revision) => revision.id === id);
        const showEditor = (state.kind === "draft" && current.revision_id === state.draft.id) || keepEditor;
        return (
          <>
            <p className="type-body max-w-reading text-ink" data-explain>
              {explain(state)}
            </p>
            {!active ? (
              <Alert variant="warning" role="status" data-enquiry-inactive>
                <TriangleAlert aria-hidden />
                <AlertDescription>{text.editor.inactive[enquiry.data?.status === "cancelled" ? "withdrawn" : enquiry.data?.status === "closed" ? "closed" : "other"]}</AlertDescription>
              </Alert>
            ) : null}
            {banner ? (
              <Alert variant="success" role="status" data-banner>
                <CircleCheck aria-hidden />
                <AlertDescription>{banner}</AlertDescription>
              </Alert>
            ) : null}
            {notice ? (
              <Alert variant="warning" role="alert" data-stale-notice>
                <TriangleAlert aria-hidden />
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            ) : null}
            {problem ? <ApiErrorMessage error={problem} /> : null}

            {showEditor ? (
              <Editor
                companyId={companyId}
                deliveryId={deliveryId}
                current={current}
                refetch={refetchCurrent}
                locked={state.kind !== "draft"}
                onLock={() => setKeepEditor(true)}
                sent={state.kind === "draft" ? state.sent : null}
                acts={acts}
                perform={perform}
                actions={actions}
              />
            ) : state.kind === "withdrawn-draft" ? (
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  data-start-new
                  aria-disabled={!acts.canStartNew}
                  onClick={() => {
                    if (!acts.canStartNew) return;
                    void perform(() => actions.startRevision.mutateAsync(), ((r: { revision_number: number }) => format(life.revise.done, { number: r.revision_number })) as never);
                  }}
                >
                  {life.startNew.button}
                </Button>
                <p className="type-small text-ink-2">{life.startNew.help}</p>
              </div>
            ) : state.kind !== "none" ? (
              <Frozen
                state={state}
                revision={view("revision" in state ? state.revision.id : "")}
                acts={acts}
                perform={perform}
                actions={actions}
                now={now}
              />
            ) : null}

            <RevisionHistory revisions={items} now={now} ids={{ companyId, deliveryId, quotationId: current.quotation_id }} />
          </>
        );
      }}
    </QueryState>
  );
}

/** A sent (or decided, withdrawn, expired) revision, read-only: its content is frozen and cannot be edited. */
function Frozen({
  state,
  revision,
  acts,
  perform,
  actions,
  now,
}: {
  state: WorkspaceState;
  revision: Revision | undefined;
  acts: LifecycleActions;
  perform: Perform;
  actions: ReturnType<typeof useQuotationActions>;
  now: number;
}) {
  if (!revision) return null;
  const sent = revision.status === "sent" && state.kind === "sent";
  return (
    <section aria-labelledby="frozen-title" className="space-y-3 rounded-card border-2 border-field-border bg-paper-2 p-5 sm:p-6" data-frozen>
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="frozen-title" className="type-heading text-ink">
          {format(life.history.revision, { number: revision.revision_number })}
        </h2>
        <Badge variant={sent ? "success" : "neutral"} icon={Lock} data-badge={sent ? "sent" : "other"}>
          {sent ? life.sentBadge : statusLabel(revision, now)}
        </Badge>
      </div>
      <p className="type-small text-ink-2">
        {revision.sent_at ? format(life.sentOn, { date: formatLongDate(revision.sent_at) ?? revision.sent_at }) : ""}
        {revision.valid_until ? ` · ${format(life.validUntil, { date: formatLongDate(revision.valid_until) ?? revision.valid_until })}` : ""}
      </p>
      <p className="type-body font-medium text-ink" data-frozen-note>
        {life.frozen}
      </p>
      <RevisionBody revision={revision} />
      {acts.canRevise || acts.canWithdraw ? (
        <div className="space-y-3">
          {acts.canRevise ? (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                data-revise
                onClick={() =>
                  void perform(() => actions.startRevision.mutateAsync(), ((r: { revision_number: number }) => format(life.revise.done, { number: r.revision_number })) as never)
                }
              >
                {life.revise.button}
              </Button>
              <p className="type-small text-ink-2">{life.revise.help}</p>
            </div>
          ) : null}
          {acts.canWithdraw ? (
            <ConfirmAction
              id="withdraw"
              label={life.withdraw.button}
              help={life.withdraw.help}
              title={life.withdraw.confirmTitle}
              body={format(life.withdraw.confirmBody, { number: revision.revision_number })}
              yes={life.withdraw.yes}
              keep={life.withdraw.keep}
              onConfirm={() => void perform(() => actions.withdraw.mutateAsync(revision.id), life.withdraw.done)}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Editor({
  companyId,
  deliveryId,
  current,
  refetch,
  locked,
  onLock,
  sent,
  acts,
  perform,
  actions,
}: {
  companyId: string;
  deliveryId: string;
  current: CurrentQuotation;
  refetch: () => Promise<{ data?: CurrentQuotation | null }>;
  /** True once the quotation is no longer a draft: the typed input stays visible but cannot be saved. */
  locked: boolean;
  onLock: () => void;
  /** The sent revision the customer still sees while this revision is being drafted, if any. */
  sent: { revision_number: number } | null;
  acts: LifecycleActions;
  perform: Perform;
  actions: ReturnType<typeof useQuotationActions>;
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

  return (
    <>
      {locked ? (
        <Alert variant="warning" role="status" data-locked>
          <Lock aria-hidden />
          <AlertDescription>{format(text.editor.notDraft, { status: statusNames[current.status] ?? current.status })}</AlertDescription>
        </Alert>
      ) : inactive ? (
        <Alert variant="warning" role="status" data-inactive>
          <TriangleAlert aria-hidden />
          <AlertDescription>{text.editor.inactive[inactiveReason]}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert variant="success" role="status" data-message>
          <CircleCheck aria-hidden />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert variant="warning" role="alert" data-stale-notice>
          <TriangleAlert aria-hidden />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      {problem ? <ApiErrorMessage error={problem} /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start" data-editor-layout>
      <div className="min-w-0">
      <AppForm
        form={form}
        className="space-y-6"
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
        <fieldset className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" data-section="lines">
          <legend className="type-heading float-left mb-2 w-full text-ink">{text.lines.title}</legend>
          <p className="type-small clear-both text-ink-2">{text.lines.intro}</p>
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
            <Button type="button" variant="outline" onClick={() => fields.append({ ...blankLine })}>
              {text.lines.add}
            </Button>
          ) : (
            <p className="type-small text-ink-2">{format(text.lines.limit, { max: MAX_LINES })}</p>
          )}
        </fieldset>

        <fieldset className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" data-section="pricing">
          <legend className="type-heading float-left mb-2 w-full text-ink">{text.pricing.title}</legend>
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

        <fieldset className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" data-section="terms">
          <legend className="type-heading float-left mb-2 w-full text-ink">{text.terms.title}</legend>
          <TextField form={form} name="capacity_kwp" label={text.terms.capacity} inputMode="decimal" optional />
          <TextareaField form={form} name="warranty_terms" label={text.terms.warranty} maxLength={2000} />
          <TextareaField form={form} name="exclusions" label={text.terms.exclusions} description={text.terms.exclusionsHelp} maxLength={2000} />
          <TextField form={form} name="validity_days" label={text.terms.validity} description={text.terms.validityHelp} inputMode="numeric" optional />
          <TextareaField form={form} name="notes" label={text.terms.notes} description={text.terms.notesHelp} maxLength={4000} />
        </fieldset>

        {dirty ? (
          <p className="flex items-center gap-2 font-medium text-warning" data-unsaved>
            <TriangleAlert aria-hidden className="size-4 shrink-0" />
            {text.unsaved}
          </p>
        ) : null}
        <FormSubmitButton pending={form.formState.isSubmitting}>{text.save}</FormSubmitButton>
      </AppForm>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-40" aria-label={text.totals.title}>
      <TotalsPanel terms={terms} dirty={dirty} />

      <section aria-labelledby="checklist-title" className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-e1">
        <h2 id="checklist-title" className="type-subheading text-ink">
          {text.checklist.title}
        </h2>
        {missing.length === 0 ? (
          <p className="flex items-center gap-2 text-sm font-medium text-ink" data-ready>
            <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
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

      <section aria-labelledby="send-title" className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-e1" data-send-section>
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="send-title" className="type-subheading text-ink">
            {life.send.title}
          </h2>
          <Badge variant="neutral" data-badge="draft">
            {life.draftBadge}
          </Badge>
        </div>
        <p className="type-small text-ink-2">{life.send.intro}</p>
        {dirty ? (
          <p className="text-sm font-medium text-warning" data-need-saved>
            {life.send.needSaved}
          </p>
        ) : missing.length > 0 ? (
          <p className="text-sm font-medium text-warning" data-need-complete>
            {life.send.needComplete}
          </p>
        ) : null}
        <ConfirmAction
          id="send"
          label={life.send.button}
          title={life.send.confirmTitle}
          body={format(life.send.confirmBody, { number: current.revision_number, total: formatMoney(terms.total) ?? "", days: terms.validity_days ?? "" })}
          yes={life.send.yes}
          keep={life.send.keep}
          variant="default"
          disabled={!acts.canSend || locked || dirty || missing.length > 0}
          onConfirm={() => {
            // The confirmation can only open when sending is allowed, but check again at the moment of sending.
            if (!acts.canSend || locked || dirty || missing.length > 0) return;
            void perform(() => actions.send.mutateAsync(), ((r: { revision_number: number }) => format(life.send.done, { number: r.revision_number })) as never);
          }}
        />
        {acts.canDiscardDraft ? (
          <ConfirmAction
            id="discard"
            label={life.discard.button}
            help={life.discard.help}
            title={life.discard.confirmTitle}
            body={sent ? format(life.discard.confirmBodySent, { sent: sent.revision_number }) : life.discard.confirmBody}
            yes={life.discard.yes}
            keep={life.discard.keep}
            onConfirm={() => void perform(() => actions.withdraw.mutateAsync(current.revision_id), life.discard.done)}
          />
        ) : null}
        {sent ? (
          <p className="type-small text-ink-2" data-withdraw-blocked>
            {life.withdraw.blockedByDraft}
          </p>
        ) : null}
      </section>
      </aside>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden" data-total-bar>
        <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-ink-2">{text.totals.badge}</span>
          <span className="type-figure text-base font-semibold text-ink">
            {terms.total === null ? text.totals.none : formatMoney(terms.total)}
          </span>
        </p>
        {dirty ? <p className="text-xs font-medium text-warning">{text.totals.stale}</p> : null}
      </div>
    </>
  );
}
