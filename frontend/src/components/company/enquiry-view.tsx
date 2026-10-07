"use client";

import { BackLink } from "@/components/ui/back-link";
import { CircleCheck, Eye, Lock, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { QuotationSection } from "@/components/company/quotation-section";
import { StaffGate } from "@/components/company/staff-gate";
import { AppForm } from "@/components/forms/app-form";
import { FormSubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { QueryState } from "@/components/query-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusNote } from "@/components/ui/status-note";
import type { ApiError } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { useCurrentUser } from "@/lib/api/hooks";
import { formatLongDate } from "@/lib/catalogue/detail";
import { useAddNote, useCloseEnquiry, useEnquiry, useMarkProgress, useNotes } from "@/lib/inbox/hooks";
import {
  availableActions,
  companyStatusLabel,
  customerSees,
  enquiryTone,
  MAX_NOTE,
  noteAuthor,
  noteSchema,
  staleMessage,
} from "@/lib/inbox/inbox";
import { useAppForm } from "@/lib/forms/use-app-form";
import { format, messages } from "@/messages";

const text = messages.company.inbox;
const shared = text.shared;
const notesText = text.notes;

type Enquiry = components["schemas"]["CompanyDeliveryDetail"];

/** One enquiry: what the customer wrote, the progress the customer can see, and internal notes they cannot. */
export function EnquiryView({ id }: { id: string }) {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <StaffGate basePath={`/company/inbox/${id}`}>
        {(company) => (
          <>
            <BackLink href={`/company/inbox?company=${company.company_id}`}>{text.detail.back}</BackLink>
            <Enquiry companyId={company.company_id} id={id} />
          </>
        )}
      </StaffGate>
    </div>
  );
}

function Enquiry({ companyId, id }: { companyId: string; id: string }) {
  const query = useEnquiry(companyId, id);
  return (
    <QueryState query={query}>
      {(enquiry) => (
        <Detail
          companyId={companyId}
          enquiry={enquiry}
          refreshing={query.isRefetching}
          refetch={query.refetch}
        />
      )}
    </QueryState>
  );
}

function Detail({
  companyId,
  enquiry,
  refreshing,
  refetch,
}: {
  companyId: string;
  enquiry: Enquiry;
  refreshing: boolean;
  refetch: () => Promise<{ data?: Enquiry }>;
}) {
  const progress = useMarkProgress(companyId, enquiry.id);
  const close = useCloseEnquiry(companyId, enquiry.id);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const confirmRef = useRef<HTMLHeadingElement>(null);
  // Synchronous guard: React state is too slow to stop two clicks in the same moment.
  const inFlight = useRef(false);
  const actions = availableActions(enquiry);
  const requirements = enquiry.requirements as { district?: string; monthly_consumption_kwh?: string | null; details?: string };

  const run = (start: (callbacks: { onSuccess: () => void; onError: (error: ApiError) => void; onSettled: () => void }) => void, success: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setMessage(null);
    setNotice(null);
    setProblem(null);
    start({
      onSuccess: () => setMessage(success),
      onError: (error) => {
        setConfirmingClose(false);
        if (error.status === 409) {
          // The enquiry moved on since the page loaded: read it again and say what changed.
          void refetch().then((fresh) => setNotice(staleMessage(fresh.data)));
        } else {
          setProblem(error);
        }
      },
      onSettled: () => {
        inFlight.current = false;
      },
    });
  };

  const markOpened = () =>
    run((cb) => progress.mutate("viewed", cb), format(shared.done, { status: customerSees("viewed") }));
  const markResponding = () =>
    run((cb) => progress.mutate("responding", cb), format(shared.done, { status: customerSees("responding") }));
  const confirmClose = () =>
    run((cb) => close.mutate(undefined, { ...cb, onSuccess: () => { setConfirmingClose(false); cb.onSuccess(); } }), shared.closed);

  return (
    <>
      <header className="space-y-3 rounded-panel border border-line bg-surface p-6 shadow-e1" data-enquiry-header>
        <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{text.detail.eyebrow}</p>
        <h1 className="type-display-m text-ink">{text.detail.title}</h1>
        <h2 data-status={enquiry.status}>
          <Badge variant={enquiryTone(enquiry.status)}>{companyStatusLabel(enquiry.status)}</Badge>
        </h2>
        <p className="type-small text-ink-2">
          {format(text.detail.received, { date: formatLongDate(enquiry.created_at) ?? enquiry.created_at })}
          {enquiry.viewed_at ? ` · ${format(text.detail.opened, { date: formatLongDate(enquiry.viewed_at) ?? enquiry.viewed_at })}` : ""}
        </p>
        <Button type="button" variant="outline" onClick={() => void refetch()} aria-disabled={refreshing}>
          {refreshing ? text.detail.refreshing : text.detail.refresh}
        </Button>
      </header>

      <section aria-labelledby="customer-title" className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" data-customer-section>
        <h2 id="customer-title" className="type-heading text-ink">
          {text.customer.title}
        </h2>
        <p className="type-small text-ink-2">{text.customer.note}</p>
        <dl className="description-list text-sm">
          <dt className="text-ink-2">{text.customer.district}</dt>
          <dd className="font-medium">{requirements.district ?? ""}</dd>
          <dt className="text-ink-2">{text.customer.consumption}</dt>
          <dd>
            {requirements.monthly_consumption_kwh
              ? format(text.customer.consumptionValue, { value: requirements.monthly_consumption_kwh })
              : text.customer.consumptionNone}
          </dd>
          <dt className="text-ink-2">{text.customer.details}</dt>
          <dd className="whitespace-pre-wrap rounded-field border border-line bg-paper p-3 text-ink">{requirements.details ?? ""}</dd>
        </dl>
      </section>

      <section aria-labelledby="shared-title" className="space-y-3 rounded-card border-2 border-info bg-info-tint p-5 sm:p-6" data-shared-section>
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="shared-title" className="type-heading text-ink">
            {shared.title}
          </h2>
          <Badge variant="info" icon={Eye} data-badge="shared">
            {shared.badge}
          </Badge>
        </div>
        <p className="type-small text-ink">{shared.intro}</p>
        <p className="text-sm text-ink">
          <span className="font-medium">{shared.current}: </span>
          {companyStatusLabel(enquiry.status)}
          <span className="block text-ink-2">{format(shared.customerSees, { status: customerSees(enquiry.status) })}</span>
        </p>
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
        {actions.inactiveReason ? (
          <p className="type-body text-ink" data-inactive>
            {shared.inactive[actions.inactiveReason]}
          </p>
        ) : (
          <div className="space-y-3">
            {actions.canMarkOpened ? (
              <div className="space-y-2">
                <Button type="button" variant="outline" onClick={markOpened} aria-disabled={progress.isPending} data-mark-opened>
                  {progress.isPending ? shared.working : shared.markOpened}
                </Button>
                <p className="type-small text-ink-2">{shared.markOpenedHelp}</p>
              </div>
            ) : null}
            {actions.canMarkResponding ? (
              <div className="space-y-2">
                <Button type="button" variant="outline" onClick={markResponding} aria-disabled={progress.isPending} data-mark-responding>
                  {progress.isPending ? shared.working : shared.markResponding}
                </Button>
                <p className="type-small text-ink-2">{shared.markRespondingHelp}</p>
              </div>
            ) : null}
            {confirmingClose ? (
              <div role="group" aria-labelledby="close-title" className="space-y-3 rounded-card border-2 border-orange-text bg-surface p-5 shadow-e2" data-confirm-close>
                <h3 id="close-title" ref={confirmRef} tabIndex={-1} className="type-subheading text-ink outline-none">
                  {shared.closeTitle}
                </h3>
                <p className="type-body text-ink">{shared.closeBody}</p>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={confirmClose} aria-disabled={close.isPending} data-close-yes>
                    {shared.closeYes}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setConfirmingClose(false)}>
                    {shared.closeKeep}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setMessage(null);
                    setConfirmingClose(true);
                    setTimeout(() => confirmRef.current?.focus(), 0);
                  }}
                  data-close
                >
                  {shared.close}
                </Button>
                <p className="type-small text-ink-2">{shared.closeHelp}</p>
              </div>
            )}
          </div>
        )}
      </section>

      <QuotationSection
        companyId={companyId}
        deliveryId={enquiry.id}
        active={actions.canAddNote}
        onRefused={() => void refetch().then((fresh) => setNotice(staleMessage(fresh.data)))}
      />

      <Notes companyId={companyId} id={enquiry.id} canAdd={actions.canAddNote} onStale={() => void refetch().then((fresh) => setNotice(staleMessage(fresh.data)))} />
    </>
  );
}

function Notes({ companyId, id, canAdd, onStale }: { companyId: string; id: string; canAdd: boolean; onStale: () => void }) {
  const query = useNotes(companyId, id);
  const me = useCurrentUser();
  const add = useAddNote(companyId, id);
  const form = useAppForm(noteSchema, { defaultValues: { body: "" } });
  const [saved, setSaved] = useState(false);

  return (
    <section
      aria-labelledby="notes-title"
      className="space-y-3 rounded-card border-2 border-dashed border-ink-3 bg-paper-2 p-5 sm:p-6"
      data-internal-section
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="notes-title" className="type-heading text-ink">
          {notesText.title}
        </h2>
        <Badge variant="neutral" icon={Lock} className="border-ink-3 font-semibold text-ink" data-badge="internal">
          {notesText.badge}
        </Badge>
      </div>
      <p className="type-small text-ink">{notesText.intro}</p>

      <QueryState
        query={query}
        isEmpty={(page) => page.items.length === 0}
        empty={<p className="type-body text-ink-2" data-no-notes>{notesText.empty}</p>}
      >
        {(page) => (
          <ul className="space-y-3" data-notes>
            {page.items.map((note) => (
              <li key={note.id} className="space-y-1 rounded-field border border-line bg-surface p-3 text-sm" data-note>
                <p className="text-xs text-ink-2">
                  <span className="font-medium text-ink">{notesText.badge}</span>
                  {" · "}
                  {format(notesText.writtenBy, {
                    who: noteAuthor(note.author_id, me.data?.id),
                    date: formatLongDate(note.created_at) ?? note.created_at,
                  })}
                </p>
                <p className="whitespace-pre-wrap">{note.body}</p>
              </li>
            ))}
          </ul>
        )}
      </QueryState>

      {canAdd ? (
        <AppForm
          form={form}
          className="space-y-3"
          onSubmit={async ({ body }) => {
            setSaved(false);
            try {
              await add.mutateAsync(body);
              form.reset({ body: "" });
              setSaved(true);
            } catch (error) {
              // The enquiry stopped being active (withdrawn or closed): say so from its fresh state.
              if ((error as ApiError).status === 409) {
                onStale();
                return;
              }
              throw error;
            }
          }}
        >
          <TextareaField form={form} name="body" label={notesText.add} description={notesText.addHelp} maxLength={MAX_NOTE} />
          <FormSubmitButton pending={form.formState.isSubmitting}>{notesText.save}</FormSubmitButton>
          {saved ? (
            <StatusNote tone="success" data-note-saved>
              {notesText.saved}
            </StatusNote>
          ) : null}
        </AppForm>
      ) : (
        <p className="type-body text-ink" data-no-notes-allowed>
          {notesText.inactive}
        </p>
      )}
    </section>
  );
}
