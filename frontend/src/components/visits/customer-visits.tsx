"use client";

import { CalendarCheck, CircleCheck, Clock, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { QueryState } from "@/components/query-state";
import { SlotFields } from "@/components/visits/slot-fields";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api/errors";
import { actionLabel, customerCan, emptyRow, formatRange, slotRequest, type SlotRow, statusLabel, visitTone } from "@/lib/visits/slots";
import { type SiteVisit, useCustomerVisitActions, useMyVisits, useVisitOutcome } from "@/lib/visits/hooks";
import { format, messages } from "@/messages";

const text = messages.visits.customer;

/** The customer's site visits for one installation: ask, accept another time, change or cancel. */
export function CustomerVisits({ installationId }: { installationId: string }) {
  const query = useMyVisits(installationId);
  const actions = useCustomerVisitActions(installationId);
  const busy = useRef(false);
  const [rows, setRows] = useState<SlotRow[]>([emptyRow()]);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [refused, setRefused] = useState(false);

  const start = () => {
    // A synchronous guard: state updates are too slow to stop a rapid second click.
    if (busy.current) return false;
    busy.current = true;
    setNotice(null);
    setFailure(null);
    setRefused(false);
    return true;
  };
  const handlers = (message: string) => ({
    onSuccess: () => {
      busy.current = false;
      setNotice(message);
    },
    onError: (error: ApiError) => {
      busy.current = false;
      // A 409 on an action means the visit moved on; the list is read again, so the page explains from it.
      if (error.status === 404) setRefused(true);
      else setFailure(error);
    },
  });

  const open = (query.data ?? []).some((visit) => visit.status === "requested" || visit.status === "alternatives_offered");
  return (
    <section aria-labelledby="visits-title" className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" data-visits>
      <h2 id="visits-title" className="type-heading text-ink">
        {text.title}
      </h2>
      <p className="type-body max-w-reading text-ink-2">{text.intro}</p>
      {notice ? (
        <Alert variant="success" role="status" data-notice>
          <CircleCheck aria-hidden />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      {refused ? (
        <Alert variant="warning" role="alert" data-refused>
          <TriangleAlert aria-hidden />
          <AlertDescription>{text.refused}</AlertDescription>
        </Alert>
      ) : null}
      {failure ? <ApiErrorMessage error={failure} /> : null}
      <QueryState query={query} isEmpty={(items) => items.length === 0} empty={<p className="type-body text-ink-2" data-none>{text.none}</p>}>
        {(items) => (
          <ul className="space-y-3">
            {items.map((visit) => (
              <VisitCard key={visit.id} visit={visit} installationId={installationId} start={start} handlers={handlers} actions={actions} />
            ))}
          </ul>
        )}
      </QueryState>
      {open ? (
        <Alert variant="info" role="note" data-waiting>
          <Clock aria-hidden />
          <AlertDescription>{text.waiting}</AlertDescription>
        </Alert>
      ) : (
        <form
          noValidate
          className="space-y-4 rounded-card border border-line bg-paper p-4 text-sm sm:p-5"
          data-request-form
          onSubmit={(event) => {
            event.preventDefault();
            const result = slotRequest(rows);
            setErrors(result.errors);
            if (result.slots.length === 0) return;
            if (!start()) return;
            actions.request.mutate(
              { slots: result.slots, note: note.trim() || null },
              {
                onSuccess: () => {
                  busy.current = false;
                  setNotice(text.requested);
                  setRows([emptyRow()]);
                  setNote("");
                },
                onError: (error) => {
                  busy.current = false;
                  setFailure(error);
                },
              },
            );
          }}
        >
          <SlotFields id="request" rows={rows} errors={errors} onChange={setRows} />
          <div className="space-y-1">
            <label htmlFor="visit-note" className="block font-medium text-ink">
              {text.noteLabel}
            </label>
            <textarea id="visit-note" value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={1000} aria-describedby="visit-note-help" className="w-full field-control p-2" />
            <p id="visit-note-help" className="text-ink-2">
              {text.noteHelp}
            </p>
          </div>
          <Button type="submit" aria-disabled={actions.request.isPending} data-action="request-visit">
            {actions.request.isPending ? text.requesting : text.request}
          </Button>
        </form>
      )}
    </section>
  );
}

function VisitCard({ visit, installationId, start, handlers, actions }: { visit: SiteVisit; installationId: string; start: () => boolean; handlers: (message: string) => { onSuccess: () => void; onError: (e: ApiError) => void }; actions: ReturnType<typeof useCustomerVisitActions> }) {
  const can = customerCan(visit.status);
  const [changing, setChanging] = useState(false);
  const [rows, setRows] = useState<SlotRow[]>([emptyRow()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const finished = visit.status === "completed";
  const outcome = useVisitOutcome(installationId, visit.id, finished || visit.status === "cancelled" || visit.status === "confirmed");
  const proposed = visit.slots.filter((slot) => slot.kind === "proposed");
  const preferred = visit.slots.filter((slot) => slot.kind === "preferred");
  return (
    <li className="space-y-3 rounded-card border border-line bg-paper p-4 text-sm" data-visit={visit.status}>
      <VisitStatusBlock visit={visit} preferred={preferred} />
      {can.accept ? (
        <div className="space-y-2" data-offered>
          <p className="font-medium text-ink">{text.offered}</p>
          <ul className="space-y-2">
            {proposed.map((slot) => (
              <li key={slot.id} className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-line bg-surface p-3">
                <span className="font-medium text-ink">{formatRange(slot.starts_at, slot.ends_at, visit.timezone)}</span>
                <Button
                  type="button"
                  aria-disabled={actions.accept.isPending}
                  data-action="accept-time"
                  onClick={() => {
                    if (actions.accept.isPending || !start()) return;
                    actions.accept.mutate({ visit: visit.id, slot: slot.id }, handlers(text.done));
                  }}
                >
                  {actions.accept.isPending ? text.acceptWorking : text.accept}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {finished && outcome.data?.completion_summary ? <p className="text-ink" data-summary>{format(text.completedLine, { summary: outcome.data.completion_summary })}</p> : null}
      {outcome.data && outcome.data.history.length > 0 ? (
        <details>
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-orange-text">{text.history}</summary>
          <ul className="mt-1 space-y-1">
            {outcome.data.history.map((entry, index) => (
              <li key={index}>{format(text.historyLine, { action: actionLabel(entry.action), date: new Date(entry.created_at).toLocaleDateString("en-GB", { dateStyle: "long", timeZone: visit.timezone }) })}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {changing ? (
        <form
          noValidate
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const result = slotRequest(rows);
            setErrors(result.errors);
            if (result.slots.length === 0 || !start()) return;
            actions.reschedule.mutate({ visit: visit.id, slots: result.slots }, {
                ...handlers(text.done),
                onSuccess: () => {
                  handlers(text.done).onSuccess();
                  setChanging(false);
                  setRows([emptyRow()]);
                },
              });
          }}
        >
          <SlotFields id={`re-${visit.id}`} rows={rows} errors={errors} onChange={setRows} />
          <Button type="submit" aria-disabled={actions.reschedule.isPending} data-action="reschedule-send">
            {text.rescheduleSend}
          </Button>
        </form>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {can.reschedule && !changing ? (
          <Button type="button" variant="outline" data-action="reschedule" onClick={() => setChanging(true)}>
            {text.reschedule}
          </Button>
        ) : null}
        {can.cancel ? (
          <ConfirmAction
            id={`cancel-${visit.id}`}
            label={text.cancel}
            title={text.cancelTitle}
            body={text.cancelBody}
            yes={text.cancelYes}
            keep={text.keep}
            disabled={actions.cancel.isPending}
            onConfirm={() => {
              if (!start()) return;
              actions.cancel.mutate(visit.id, handlers(text.done));
            }}
          />
        ) : null}
      </div>
    </li>
  );
}

/** The top of a visit: its status as a chip, the confirmed time (the thing most people look for) and, while it waits, the times that were asked for. */
export function VisitStatusBlock({ visit, preferred }: { visit: Pick<SiteVisit, "status" | "confirmed_starts_at" | "confirmed_ends_at" | "timezone">; preferred: readonly { id: string; starts_at: string; ends_at: string }[] }) {
  return (
    <>
      <Badge variant={visitTone(visit.status)} data-visit-status>
        {statusLabel(visit.status)}
      </Badge>
      {visit.confirmed_starts_at && visit.confirmed_ends_at && visit.status !== "cancelled" ? (
        <p className="flex items-start gap-2 rounded-field bg-success-tint p-3 font-medium text-ink" data-confirmed>
          <CalendarCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
          {format(text.confirmedLine, { range: formatRange(visit.confirmed_starts_at, visit.confirmed_ends_at, visit.timezone) })}
        </p>
      ) : null}
      {visit.status === "requested" ? (
        <ul className="list-disc pl-5 text-ink">
          {preferred.map((slot) => (
            <li key={slot.id}>{formatRange(slot.starts_at, slot.ends_at, visit.timezone)}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
