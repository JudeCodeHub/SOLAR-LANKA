"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { StaffGate } from "@/components/company/staff-gate";
import { AppForm } from "@/components/forms/app-form";
import { FormSubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { useCurrentUser } from "@/lib/api/hooks";
import { formatLongDate } from "@/lib/catalogue/detail";
import { useAddNote, useCloseEnquiry, useEnquiry, useMarkProgress, useNotes } from "@/lib/inbox/hooks";
import {
  availableActions,
  companyStatusLabel,
  customerSees,
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
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <StaffGate basePath={`/company/inbox/${id}`}>
        {(company) => (
          <>
            <Link href={`/company/inbox?company=${company.company_id}`} className="text-sm underline underline-offset-2">
              {text.detail.back}
            </Link>
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
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.detail.title}</h1>
        <h2 className="text-lg font-medium" data-status={enquiry.status}>
          {companyStatusLabel(enquiry.status)}
        </h2>
        <p className="text-sm text-muted-foreground">
          {format(text.detail.received, { date: formatLongDate(enquiry.created_at) ?? enquiry.created_at })}
          {enquiry.viewed_at ? ` · ${format(text.detail.opened, { date: formatLongDate(enquiry.viewed_at) ?? enquiry.viewed_at })}` : ""}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} aria-disabled={refreshing}>
          {refreshing ? text.detail.refreshing : text.detail.refresh}
        </Button>
      </header>

      <section aria-labelledby="customer-title" className="space-y-2" data-customer-section>
        <h2 id="customer-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.customer.title}
        </h2>
        <p className="text-sm text-muted-foreground">{text.customer.note}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{text.customer.district}</dt>
          <dd>{requirements.district ?? ""}</dd>
          <dt className="text-muted-foreground">{text.customer.consumption}</dt>
          <dd>
            {requirements.monthly_consumption_kwh
              ? format(text.customer.consumptionValue, { value: requirements.monthly_consumption_kwh })
              : text.customer.consumptionNone}
          </dd>
          <dt className="text-muted-foreground">{text.customer.details}</dt>
          <dd className="whitespace-pre-wrap">{requirements.details ?? ""}</dd>
        </dl>
      </section>

      <section aria-labelledby="shared-title" className="space-y-3 rounded-lg border p-4" data-shared-section>
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="shared-title" className="font-heading text-xl font-semibold tracking-tight">
            {shared.title}
          </h2>
          <span className="rounded-full border px-2 py-0.5 text-xs" data-badge="shared">
            {shared.badge}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{shared.intro}</p>
        <p className="text-sm">
          <span className="font-medium">{shared.current}: </span>
          {companyStatusLabel(enquiry.status)}
          <span className="block text-muted-foreground">{format(shared.customerSees, { status: customerSees(enquiry.status) })}</span>
        </p>
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
        {actions.inactiveReason ? (
          <p className="text-sm text-muted-foreground" data-inactive>
            {shared.inactive[actions.inactiveReason]}
          </p>
        ) : (
          <div className="space-y-3">
            {actions.canMarkOpened ? (
              <div className="space-y-1">
                <Button type="button" variant="outline" onClick={markOpened} aria-disabled={progress.isPending} data-mark-opened>
                  {progress.isPending ? shared.working : shared.markOpened}
                </Button>
                <p className="text-sm text-muted-foreground">{shared.markOpenedHelp}</p>
              </div>
            ) : null}
            {actions.canMarkResponding ? (
              <div className="space-y-1">
                <Button type="button" variant="outline" onClick={markResponding} aria-disabled={progress.isPending} data-mark-responding>
                  {progress.isPending ? shared.working : shared.markResponding}
                </Button>
                <p className="text-sm text-muted-foreground">{shared.markRespondingHelp}</p>
              </div>
            ) : null}
            {confirmingClose ? (
              <div role="group" aria-labelledby="close-title" className="space-y-3 rounded-lg border p-4" data-confirm-close>
                <h3 id="close-title" ref={confirmRef} tabIndex={-1} className="font-medium outline-none">
                  {shared.closeTitle}
                </h3>
                <p className="text-sm">{shared.closeBody}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={confirmClose} aria-disabled={close.isPending} data-close-yes>
                    {shared.closeYes}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setConfirmingClose(false)}>
                    {shared.closeKeep}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
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
                <p className="text-sm text-muted-foreground">{shared.closeHelp}</p>
              </div>
            )}
          </div>
        )}
      </section>

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
      className="space-y-3 rounded-lg border-2 border-dashed bg-muted/40 p-4"
      data-internal-section
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="notes-title" className="font-heading text-xl font-semibold tracking-tight">
          {notesText.title}
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-foreground px-2 py-0.5 text-xs font-medium" data-badge="internal">
          <Lock aria-hidden className="size-3" />
          {notesText.badge}
        </span>
      </div>
      <p className="text-sm">{notesText.intro}</p>

      <QueryState
        query={query}
        isEmpty={(page) => page.items.length === 0}
        empty={<p className="text-sm text-muted-foreground" data-no-notes>{notesText.empty}</p>}
      >
        {(page) => (
          <ul className="space-y-3" data-notes>
            {page.items.map((note) => (
              <li key={note.id} className="space-y-1 rounded-md border bg-background p-3 text-sm" data-note>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{notesText.badge}</span>
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
            <p role="status" className="text-sm font-medium" data-note-saved>
              {notesText.saved}
            </p>
          ) : null}
        </AppForm>
      ) : (
        <p className="text-sm text-muted-foreground" data-no-notes-allowed>
          {notesText.inactive}
        </p>
      )}
    </section>
  );
}
