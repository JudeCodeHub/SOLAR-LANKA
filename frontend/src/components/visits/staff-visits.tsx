"use client";

import { Dropdown } from "@/components/ui/dropdown";
import { CalendarCheck, CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { QueryState } from "@/components/query-state";
import { SlotFields } from "@/components/visits/slot-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ApiError } from "@/lib/api/errors";
import { companyPhoto, type SiteVisit, useDownloadVisitPhoto, useStaffVisitActions, useStaffVisits, useTechnicians, useVisitWork } from "@/lib/visits/hooks";
import { emptyRow, formatRange, shortId, slotRequest, type SlotRow, staffCan, statusLabel, visitTone } from "@/lib/visits/slots";
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
    <section aria-labelledby="staff-visits-title" className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" data-staff-visits>
      <h2 id="staff-visits-title" className="type-heading text-ink">
        {text.title}
      </h2>
      <p className="type-body max-w-reading text-ink-2">{text.intro}</p>
      {notice ? (
        <Alert variant="success" role="status" data-notice>
          <CircleCheck aria-hidden />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      {clash ? (
        <Alert variant="warning" role="alert" data-clash>
          <TriangleAlert aria-hidden />
          <AlertDescription className="font-medium text-ink">{format(text.clash, { reason: clash })}</AlertDescription>
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
    <div className="space-y-1.5">
      <label htmlFor={`tech-${visit.id}`} className="block font-medium text-ink">
        {text.technician}
      </label>
      <Dropdown id={`tech-${visit.id}`} value={technician} onChange={(event) => { setTechnician(event.target.value); setMissing(false); }} aria-invalid={missing} className="h-11 w-full field-control px-3 sm:w-auto sm:min-w-64">
        <option value="">{text.choose}</option>
        {technicians.map((t) => (
          <option key={t.user_id} value={t.user_id}>
            {format(text.technicianLine, { id: shortId(t.user_id) })}
          </option>
        ))}
      </Dropdown>
      {technicians.length === 0 ? <p className="text-ink-2">{text.noTechnicians}</p> : null}
      {missing ? (
        <p className="flex items-center gap-1.5 font-medium text-danger" data-error="technician">
          <CircleAlert aria-hidden className="size-4 shrink-0" />
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
    <li className="space-y-3 rounded-card border border-line bg-paper p-4 text-sm" data-visit={visit.status}>
      <Badge variant={visitTone(visit.status)} data-visit-status>
        {statusLabel(visit.status)}
      </Badge>
      {visit.note ? <p className="text-ink">{format(text.note, { note: visit.note })}</p> : null}
      {visit.confirmed_starts_at && visit.confirmed_ends_at && visit.status !== "cancelled" ? (
        <p className="flex items-start gap-2 rounded-field bg-success-tint p-3 font-medium text-ink" data-confirmed><CalendarCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />{format(text.confirmedLine, { range: formatRange(visit.confirmed_starts_at, visit.confirmed_ends_at, visit.timezone), id: visit.technician_id ? shortId(visit.technician_id) : "" })}</p>
      ) : null}
      {visit.status === "completed" && work.data?.completion_summary ? <p className="text-ink" data-summary>{format(text.completedLine, { summary: work.data.completion_summary })}</p> : null}
      {can.confirm ? (
        <div className="space-y-2">
          <p className="font-medium text-ink">{text.preferred}</p>
          {choose}
          <ul className="space-y-2">
            {preferred.map((slot) => (
              <li key={slot.id} className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-line bg-surface p-3">
                <span className="font-medium text-ink">{formatRange(slot.starts_at, slot.ends_at, visit.timezone)}</span>
                <Button
                  type="button"
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
        <div className="space-y-1">
          <p className="font-medium text-ink">{text.proposed}</p>
          <ul className="list-disc pl-5 text-ink">
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
        <div className="space-y-2 rounded-field border border-line bg-surface p-4" data-work>
          <p className="type-subheading text-ink">{text.workTitle}</p>
          <p className="font-medium text-ink">{text.notes}</p>
          {work.data.notes.length === 0 ? <p className="text-ink-2">{text.noNotes}</p> : (
            <ul className="list-disc pl-5 text-ink">
              {work.data.notes.map((note) => (
                <li key={note.id}>{note.body}</li>
              ))}
            </ul>
          )}
          <p className="font-medium text-ink">{text.photos}</p>
          {work.data.evidence.length === 0 ? <p className="text-ink-2">{text.noPhotos}</p> : (
            <ul className="flex flex-wrap gap-3">
              {work.data.evidence.map((photo, index) => (
                <li key={photo.asset_id}>
                  <Button type="button" variant="outline" aria-disabled={download.isPending} data-download onClick={() => !download.isPending && download.mutate(photo.asset_id)}>
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
