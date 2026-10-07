"use client";

import { BackLink } from "@/components/ui/back-link";
import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { QueryState } from "@/components/query-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialLoader } from "@/components/ui/dial-loader";
import type { ApiError } from "@/lib/api/errors";
import { evidenceProblem } from "@/lib/installations/evidence";
import { actionLabel, canComplete, formatRange, statusLabel, visitTone } from "@/lib/visits/slots";
import { technicianPhoto, useAssignedVisit, useDownloadVisitPhoto, useTechnicianActions } from "@/lib/visits/hooks";
import { format, messages } from "@/messages";

const text = messages.visits.technician;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { dateStyle: "long", timeZone: "Asia/Colombo" });

/** One booked visit: add notes and photos, then complete it with a summary for the customer. */
export function TechnicianVisit({ id }: { id: string }) {
  const query = useAssignedVisit(id);
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <BackLink href="/technician">{text.back}</BackLink>
      <QueryState query={query}>{(visit) => <Visit id={id} visit={visit} now={query.dataUpdatedAt} />}</QueryState>
    </div>
  );
}

type Work = NonNullable<ReturnType<typeof useAssignedVisit>["data"]>;

function Visit({ id, visit, now }: { id: string; visit: Work; now: number }) {
  const actions = useTechnicianActions(id);
  const download = useDownloadVisitPhoto(technicianPhoto(id));
  const busy = useRef(false);
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [refused, setRefused] = useState(false);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const range = visit.confirmed_starts_at && visit.confirmed_ends_at ? formatRange(visit.confirmed_starts_at, visit.confirmed_ends_at, visit.timezone) : "";
  const done = visit.status === "completed";
  const ready = canComplete(visit, now);

  const begin = () => {
    // A synchronous guard: state updates are too slow to stop a rapid second click.
    if (busy.current) return false;
    busy.current = true;
    setNotice(null);
    setProblem(null);
    setFailure(null);
    setRefused(false);
    return true;
  };
  const handlers = (message: string, after?: () => void) => ({
    onSuccess: () => {
      busy.current = false;
      setNotice(message);
      after?.();
      setTimeout(() => statusRef.current?.focus(), 0);
    },
    onError: (error: ApiError) => {
      busy.current = false;
      if (error.status === 409 || error.status === 404) setRefused(true);
      else if (error.status === 422) setProblem(text.photoRefused);
      else setFailure(error);
    },
  });

  return (
    <>
      <header className="space-y-3 rounded-panel border border-line bg-surface p-5 shadow-e1 sm:p-6" data-visit-header>
        <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{text.detailEyebrow}</p>
        <h1 className="type-display-m text-ink">{text.detailTitle}</h1>
        <p ref={statusRef} tabIndex={-1} role="status" className="flex flex-wrap items-center gap-2 outline-none" data-status>
          {notice ? <CircleCheck aria-hidden className="size-5 text-success" /> : null}
          {notice ? <span className="font-medium text-ink">{notice}</span> : <Badge variant={visitTone(visit.status)}>{statusLabel(visit.status)}</Badge>}
        </p>
        <dl className="description-list text-base">
          <dt className="text-ink-2">{text.whenLabel}</dt>
          <dd className="type-figure font-semibold text-ink" data-when>{range}</dd>
          <dt className="text-ink-2">{text.districtLabel}</dt>
          <dd className="font-medium text-ink">{visit.district ?? ""}</dd>
        </dl>
        <p className="rounded-field border border-line bg-paper p-3 text-sm text-ink" data-customer-note>
          {visit.customer_note ? format(text.customerNote, { note: visit.customer_note }) : text.noCustomerNote}
        </p>
      </header>
      {refused ? (
        <Alert variant="warning" role="alert" data-refused>
          <TriangleAlert aria-hidden />
          <AlertDescription>{text.refused}</AlertDescription>
        </Alert>
      ) : null}
      {failure ? <ApiErrorMessage error={failure} /> : null}

      {done ? (
        <p className="flex items-start gap-2 rounded-card border border-success bg-success-tint p-4 text-sm text-ink" data-completed>
          <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
          {format(text.completed, { when: visit.completed_at ? day(visit.completed_at) : "", summary: visit.completion_summary ?? "" })}
        </p>
      ) : (
        <section aria-labelledby="complete-title" className="space-y-3 rounded-card border-2 border-orange-text bg-surface p-5 shadow-e2" data-complete>
          <h2 id="complete-title" className="type-heading text-ink">
            {text.completeTitle}
          </h2>
          {!ready ? (
            <p className="type-body text-ink" data-not-started>
              {text.notStarted}
            </p>
          ) : (
            <>
              <p className="type-small text-ink-2">{text.completeHelp}</p>
              <label htmlFor="summary" className="block font-medium text-ink">
                {text.summaryLabel}
              </label>
              <textarea id="summary" rows={3} value={summary} maxLength={2000} onChange={(event) => setSummary(event.target.value)} aria-invalid={Boolean(errors.summary)} aria-describedby={errors.summary ? "summary-error" : undefined} className="w-full field-control p-3 text-base" />
              {errors.summary ? (
                <p id="summary-error" className="flex items-center gap-1.5 text-sm font-medium text-danger" data-error="summary">
                  <CircleAlert aria-hidden className="size-4 shrink-0" />
                  {errors.summary}
                </p>
              ) : null}
              <ConfirmAction
                id="complete"
                variant="default"
                label={actions.complete.isPending ? text.completeWorking : text.complete}
                title={text.completeTitleConfirm}
                body={text.completeBody}
                yes={text.completeYes}
                keep={text.keep}
                disabled={actions.complete.isPending}
                onBeforeOpen={() => {
                  const missing = summary.trim() === "";
                  setErrors(missing ? { summary: text.errors.summary } : {});
                  return !missing;
                }}
                onConfirm={() => {
                  if (!begin()) return;
                  actions.complete.mutate(summary.trim(), handlers(text.completedNotice));
                }}
              />
            </>
          )}
        </section>
      )}

      <section aria-labelledby="notes-title" className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-e1">
        <h2 id="notes-title" className="type-heading text-ink">
          {text.notesTitle}
        </h2>
        <p className="type-small text-ink-2">{text.notesHelp}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink" data-notes>
          {visit.notes.map((entry) => (
            <li key={entry.id}>{entry.body}</li>
          ))}
        </ul>
        <form
          noValidate
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (note.trim() === "") {
              setErrors({ note: text.errors.note });
              return;
            }
            setErrors({});
            if (!begin()) return;
            actions.note.mutate(note.trim(), handlers(text.noteSaved, () => setNote("")));
          }}
        >
          <label htmlFor="note" className="block font-medium text-ink">
            {text.noteLabel}
          </label>
          <textarea id="note" rows={2} value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} aria-invalid={Boolean(errors.note)} aria-describedby={errors.note ? "note-error" : undefined} className="w-full field-control p-3 text-base" />
          {errors.note ? (
            <p id="note-error" className="flex items-center gap-1.5 text-sm font-medium text-danger" data-error="note">
              <CircleAlert aria-hidden className="size-4 shrink-0" />
              {errors.note}
            </p>
          ) : null}
          <Button type="submit" aria-disabled={actions.note.isPending} data-action="add-note">
            {actions.note.isPending ? text.noteSaving : text.noteSave}
          </Button>
        </form>
      </section>

      <section aria-labelledby="photos-title" className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-e1">
        <h2 id="photos-title" className="type-heading text-ink">
          {text.photosTitle}
        </h2>
        <p className="type-small text-ink-2">{text.photosHelp}</p>
        {visit.evidence.length === 0 ? (
          <p className="type-body text-ink-2">{text.noPhotos}</p>
        ) : (
          <ul className="flex flex-wrap gap-3" data-photos>
            {visit.evidence.map((photo, index) => (
              <li key={photo.asset_id}>
                <Button type="button" variant="outline" aria-disabled={download.isPending} data-download onClick={() => !download.isPending && download.mutate(photo.asset_id)}>
                  {format(text.photoDownload, { number: index + 1 })}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <label htmlFor="photo" className="block font-medium text-ink">
          {text.photoLabel}
        </label>
        <input
          id="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={actions.upload.isPending}
          aria-describedby={problem ? "photo-error" : undefined}
          aria-invalid={Boolean(problem)}
          className="field-control block min-h-14 w-full min-w-0 cursor-pointer p-2 text-sm file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-full file:border-0 file:bg-paper-2 file:px-4 file:font-medium file:text-ink"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const found = evidenceProblem(file);
            setProblem(found);
            if (found || !begin()) return;
            actions.upload.mutate(file, handlers(text.photoDone));
          }}
        />
        {actions.upload.isPending ? (
          <p role="status" className="flex items-center gap-2 text-sm text-ink">
            <DialLoader className="size-5 text-orange-text" />
            {text.photoUploading}
          </p>
        ) : null}
        {problem ? (
          <p id="photo-error" role="alert" className="flex items-center gap-1.5 text-sm font-medium text-danger" data-error="photo">
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {problem}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="history-title" className="space-y-3">
        <h2 id="history-title" className="type-heading text-ink">
          {text.history}
        </h2>
        <ul className="space-y-1 text-sm text-ink" data-history>
          {visit.history.map((entry, index) => (
            <li key={index}>{format(messages.visits.customer.historyLine, { action: actionLabel(entry.action), date: day(entry.created_at) })}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
