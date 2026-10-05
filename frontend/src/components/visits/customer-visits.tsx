"use client";

import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { QueryState } from "@/components/query-state";
import { SlotFields } from "@/components/visits/slot-fields";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api/errors";
import { actionLabel, customerCan, emptyRow, formatRange, slotRequest, type SlotRow, statusLabel } from "@/lib/visits/slots";
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
    <section aria-labelledby="visits-title" className="space-y-3" data-visits>
      <h2 id="visits-title" className="font-heading text-xl font-semibold tracking-tight">
        {text.title}
      </h2>
      <p className="text-sm text-muted-foreground">{text.intro}</p>
      {notice ? (
        <p role="status" className="text-sm font-medium" data-notice>
          {notice}
        </p>
      ) : null}
      {refused ? (
        <p role="alert" className="text-sm font-medium" data-refused>
          {text.refused}
        </p>
      ) : null}
      {failure ? <ApiErrorMessage error={failure} /> : null}
      <QueryState query={query} isEmpty={(items) => items.length === 0} empty={<p className="text-sm text-muted-foreground" data-none>{text.none}</p>}>
        {(items) => (
          <ul className="space-y-3">
            {items.map((visit) => (
              <VisitCard key={visit.id} visit={visit} installationId={installationId} start={start} handlers={handlers} actions={actions} />
            ))}
          </ul>
        )}
      </QueryState>
      {open ? (
        <p className="text-sm text-muted-foreground" data-waiting>
          {text.waiting}
        </p>
      ) : (
        <form
          noValidate
          className="space-y-3 rounded-lg border p-3 text-sm"
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
            <label htmlFor="visit-note" className="block font-medium">
              {text.noteLabel}
            </label>
            <textarea id="visit-note" value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={1000} aria-describedby="visit-note-help" className="w-full field-control p-2" />
            <p id="visit-note-help" className="text-muted-foreground">
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
    <li className="space-y-2 rounded-lg border p-3 text-sm" data-visit={visit.status}>
      <p className="font-medium" data-visit-status>
        {statusLabel(visit.status)}
      </p>
      {visit.confirmed_starts_at && visit.confirmed_ends_at && visit.status !== "cancelled" ? (
        <p data-confirmed>{format(text.confirmedLine, { range: formatRange(visit.confirmed_starts_at, visit.confirmed_ends_at, visit.timezone) })}</p>
      ) : null}
      {visit.status === "requested" ? (
        <ul className="list-disc pl-5">
          {preferred.map((slot) => (
            <li key={slot.id}>{formatRange(slot.starts_at, slot.ends_at, visit.timezone)}</li>
          ))}
        </ul>
      ) : null}
      {can.accept ? (
        <div className="space-y-2" data-offered>
          <p>{text.offered}</p>
          <ul className="space-y-2">
            {proposed.map((slot) => (
              <li key={slot.id} className="flex flex-wrap items-center gap-2">
                <span>{formatRange(slot.starts_at, slot.ends_at, visit.timezone)}</span>
                <Button
                  type="button"
                  size="sm"
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
      {finished && outcome.data?.completion_summary ? <p data-summary>{format(text.completedLine, { summary: outcome.data.completion_summary })}</p> : null}
      {outcome.data && outcome.data.history.length > 0 ? (
        <details>
          <summary className="cursor-pointer">{text.history}</summary>
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
