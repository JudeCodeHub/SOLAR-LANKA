"use client";

import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { QueryState } from "@/components/query-state";
import { SlotFields } from "@/components/visits/slot-fields";
import { Button } from "@/components/ui/button";
import { type ApiError } from "@/lib/api/errors";
import { companyPhoto, type SiteVisit, useDownloadVisitPhoto, useStaffVisitActions, useStaffVisits, useTechnicians, useVisitWork } from "@/lib/visits/hooks";
import { emptyRow, formatRange, shortId, slotRequest, type SlotRow, staffCan, statusLabel } from "@/lib/visits/slots";
import { format, messages } from "@/messages";

const text = messages.visits.staff;

/** The company's side of a customer's visits for one installation. */
export function StaffVisits({ companyId, installationId }: { companyId: string; installationId: string }) {
  const query = useStaffVisits(companyId, installationId);
  const technicians = useTechnicians(companyId);
  const actions = useStaffVisitActions(companyId, installationId);
  const busy = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [clash, setClash] = useState<string | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [refused, setRefused] = useState(false);

  const start = () => {
    // A synchronous guard: state updates are too slow to stop a rapid second click.
    if (busy.current) return false;
    busy.current = true;
    setNotice(null);
    setClash(null);
    setFailure(null);
    setRefused(false);
    return true;
  };
  const handlers = {
    onSuccess: () => {
      busy.current = false;
      setNotice(text.done);
    },
    onError: (error: ApiError) => {
      busy.current = false;
      // The server's reason for a scheduling refusal is written for people (a double-booked technician, a broken slot rule).
      if (error.status === 409) setClash(error.message);
      else if (error.status === 404) setRefused(true);
      else setFailure(error);
    },
  };

  return (
    <section aria-labelledby="staff-visits-title" className="space-y-3" data-staff-visits>
      <h2 id="staff-visits-title" className="font-heading text-xl font-semibold tracking-tight">
        {text.title}
      </h2>
      <p className="text-sm text-muted-foreground">{text.intro}</p>
      {notice ? (
        <p role="status" className="text-sm font-medium" data-notice>
          {notice}
        </p>
      ) : null}
      {clash ? (
        <p role="alert" className="text-sm font-medium" data-clash>
          {format(text.clash, { reason: clash })}
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
              <Visit key={visit.id} visit={visit} companyId={companyId} installationId={installationId} technicians={technicians.data ?? []} start={start} handlers={handlers} actions={actions} />
            ))}
          </ul>
        )}
      </QueryState>
    </section>
  );
}

function Visit({ visit, companyId, installationId, technicians, start, handlers, actions }: { visit: SiteVisit; companyId: string; installationId: string; technicians: { user_id: string }[]; start: () => boolean; handlers: { onSuccess: () => void; onError: (e: ApiError) => void }; actions: ReturnType<typeof useStaffVisitActions> }) {
  const can = staffCan(visit.status);
  const [technician, setTechnician] = useState("");
  const [offering, setOffering] = useState(false);
  const [rows, setRows] = useState<SlotRow[]>([emptyRow()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState(false);
  const work = useVisitWork(companyId, installationId, visit.id, visit.status === "confirmed" || visit.status === "completed");
  const download = useDownloadVisitPhoto(companyPhoto(companyId, installationId, visit.id));
  const preferred = visit.slots.filter((slot) => slot.kind === "preferred");
  const proposed = visit.slots.filter((slot) => slot.kind === "proposed");
  const choose = (
    <div className="space-y-1">
      <label htmlFor={`tech-${visit.id}`} className="block font-medium">
        {text.technician}
      </label>
      <select id={`tech-${visit.id}`} value={technician} onChange={(event) => { setTechnician(event.target.value); setMissing(false); }} aria-invalid={missing} className="h-11 rounded-lg border bg-transparent px-2">
        <option value="">{text.choose}</option>
        {technicians.map((t) => (
          <option key={t.user_id} value={t.user_id}>
            {format(text.technicianLine, { id: shortId(t.user_id) })}
          </option>
        ))}
      </select>
      {technicians.length === 0 ? <p className="text-muted-foreground">{text.noTechnicians}</p> : null}
      {missing ? (
        <p className="font-medium text-destructive" data-error="technician">
          {text.choose}
        </p>
      ) : null}
    </div>
  );
  const requireTechnician = () => {
    if (technician === "") {
      setMissing(true);
      return false;
    }
    return true;
  };
  return (
    <li className="space-y-3 rounded-lg border p-3 text-sm" data-visit={visit.status}>
      <p className="font-medium" data-visit-status>
        {statusLabel(visit.status)}
      </p>
      {visit.note ? <p>{format(text.note, { note: visit.note })}</p> : null}
      {visit.confirmed_starts_at && visit.confirmed_ends_at && visit.status !== "cancelled" ? (
        <p data-confirmed>{format(text.confirmedLine, { range: formatRange(visit.confirmed_starts_at, visit.confirmed_ends_at, visit.timezone), id: visit.technician_id ? shortId(visit.technician_id) : "" })}</p>
      ) : null}
      {visit.status === "completed" && work.data?.completion_summary ? <p data-summary>{format(text.completedLine, { summary: work.data.completion_summary })}</p> : null}
      {can.confirm ? (
        <div className="space-y-2">
          <p className="font-medium">{text.preferred}</p>
          {choose}
          <ul className="space-y-2">
            {preferred.map((slot) => (
              <li key={slot.id} className="flex flex-wrap items-center gap-2">
                <span>{formatRange(slot.starts_at, slot.ends_at, visit.timezone)}</span>
                <Button
                  type="button"
                  size="sm"
                  aria-disabled={actions.confirm.isPending}
                  data-action="confirm-time"
                  onClick={() => {
                    if (actions.confirm.isPending || !requireTechnician() || !start()) return;
                    actions.confirm.mutate({ visit: visit.id, slot: slot.id, technician }, handlers);
                  }}
                >
                  {actions.confirm.isPending ? text.confirmWorking : text.confirm}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {visit.status === "alternatives_offered" && proposed.length > 0 ? (
        <div>
          <p className="font-medium">{text.proposed}</p>
          <ul className="list-disc pl-5">
            {proposed.map((slot) => (
              <li key={slot.id}>{formatRange(slot.starts_at, slot.ends_at, visit.timezone)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {can.propose && !offering ? (
        <Button type="button" variant="outline" data-action="offer" onClick={() => setOffering(true)}>
          {text.offer}
        </Button>
      ) : null}
      {offering ? (
        <form
          noValidate
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const result = slotRequest(rows);
            setErrors(result.errors);
            const ready = requireTechnician();
            if (result.slots.length === 0 || !ready || !start()) return;
            actions.propose.mutate(
              { visit: visit.id, slots: result.slots, technician },
              { ...handlers, onSuccess: () => { handlers.onSuccess(); setOffering(false); setRows([emptyRow()]); } },
            );
          }}
        >
          {can.confirm ? null : choose}
          <SlotFields id={`offer-${visit.id}`} rows={rows} errors={errors} onChange={setRows} />
          <Button type="submit" aria-disabled={actions.propose.isPending} data-action="offer-send">
            {text.offerSend}
          </Button>
        </form>
      ) : null}
      {work.data && (work.data.notes.length > 0 || work.data.evidence.length > 0) ? (
        <div className="space-y-2" data-work>
          <p className="font-medium">{text.workTitle}</p>
          <p className="font-medium">{text.notes}</p>
          {work.data.notes.length === 0 ? <p className="text-muted-foreground">{text.noNotes}</p> : (
            <ul className="list-disc pl-5">
              {work.data.notes.map((note) => (
                <li key={note.id}>{note.body}</li>
              ))}
            </ul>
          )}
          <p className="font-medium">{text.photos}</p>
          {work.data.evidence.length === 0 ? <p className="text-muted-foreground">{text.noPhotos}</p> : (
            <ul className="space-y-1">
              {work.data.evidence.map((photo, index) => (
                <li key={photo.asset_id}>
                  <Button type="button" variant="outline" size="sm" aria-disabled={download.isPending} data-download onClick={() => !download.isPending && download.mutate(photo.asset_id)}>
                    {format(text.download, { number: index + 1 })}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
            actions.cancel.mutate(visit.id, handlers);
          }}
        />
      ) : null}
    </li>
  );
}
