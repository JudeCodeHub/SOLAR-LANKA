"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api/errors";
import { evidenceProblem } from "@/lib/installations/evidence";
import { actionLabel, canComplete, formatRange, statusLabel } from "@/lib/visits/slots";
import { technicianPhoto, useAssignedVisit, useDownloadVisitPhoto, useTechnicianActions } from "@/lib/visits/hooks";
import { format, messages } from "@/messages";

const text = messages.visits.technician;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { dateStyle: "long", timeZone: "Asia/Colombo" });

/** One booked visit: add notes and photos, then complete it with a summary for the customer. */
export function TechnicianVisit({ id }: { id: string }) {
  const query = useAssignedVisit(id);
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <Link href="/technician" className="inline-flex min-h-11 items-center text-sm underline underline-offset-2">
        {text.back}
      </Link>
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
      <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.detailTitle}</h1>
      <p ref={statusRef} tabIndex={-1} role="status" className="text-sm font-medium outline-none" data-status>
        {notice ?? statusLabel(visit.status)}
      </p>
      {refused ? (
        <p role="alert" className="text-sm font-medium" data-refused>
          {text.refused}
        </p>
      ) : null}
      {failure ? <ApiErrorMessage error={failure} /> : null}
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{text.whenLabel}</dt>
        <dd data-when>{range}</dd>
        <dt className="text-muted-foreground">{text.districtLabel}</dt>
        <dd>{visit.district ?? ""}</dd>
      </dl>
      <p className="text-sm" data-customer-note>
        {visit.customer_note ? format(text.customerNote, { note: visit.customer_note }) : text.noCustomerNote}
      </p>

      {done ? (
        <p className="text-sm" data-completed>
          {format(text.completed, { when: visit.completed_at ? day(visit.completed_at) : "", summary: visit.completion_summary ?? "" })}
        </p>
      ) : (
        <section aria-labelledby="complete-title" className="space-y-2" data-complete>
          <h2 id="complete-title" className="font-heading text-xl font-semibold tracking-tight">
            {text.completeTitle}
          </h2>
          {!ready ? (
            <p className="text-sm" data-not-started>
              {text.notStarted}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{text.completeHelp}</p>
              <label htmlFor="summary" className="block text-sm font-medium">
                {text.summaryLabel}
              </label>
              <textarea id="summary" rows={3} value={summary} maxLength={2000} onChange={(event) => setSummary(event.target.value)} aria-invalid={Boolean(errors.summary)} aria-describedby={errors.summary ? "summary-error" : undefined} className="w-full rounded-lg border bg-transparent p-2 text-sm" />
              {errors.summary ? (
                <p id="summary-error" className="text-sm font-medium text-destructive" data-error="summary">
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

      <section aria-labelledby="notes-title" className="space-y-2">
        <h2 id="notes-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.notesTitle}
        </h2>
        <p className="text-sm text-muted-foreground">{text.notesHelp}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm" data-notes>
          {visit.notes.map((entry) => (
            <li key={entry.id}>{entry.body}</li>
          ))}
        </ul>
        <form
          noValidate
          className="space-y-2"
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
          <label htmlFor="note" className="block text-sm font-medium">
            {text.noteLabel}
          </label>
          <textarea id="note" rows={2} value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} aria-invalid={Boolean(errors.note)} aria-describedby={errors.note ? "note-error" : undefined} className="w-full rounded-lg border bg-transparent p-2 text-sm" />
          {errors.note ? (
            <p id="note-error" className="text-sm font-medium text-destructive" data-error="note">
              {errors.note}
            </p>
          ) : null}
          <Button type="submit" variant="outline" aria-disabled={actions.note.isPending} data-action="add-note">
            {actions.note.isPending ? text.noteSaving : text.noteSave}
          </Button>
        </form>
      </section>

      <section aria-labelledby="photos-title" className="space-y-2">
        <h2 id="photos-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.photosTitle}
        </h2>
        <p className="text-sm text-muted-foreground">{text.photosHelp}</p>
        {visit.evidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">{text.noPhotos}</p>
        ) : (
          <ul className="space-y-1" data-photos>
            {visit.evidence.map((photo, index) => (
              <li key={photo.asset_id}>
                <Button type="button" variant="outline" size="sm" aria-disabled={download.isPending} data-download onClick={() => !download.isPending && download.mutate(photo.asset_id)}>
                  {format(text.photoDownload, { number: index + 1 })}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <label htmlFor="photo" className="block text-sm font-medium">
          {text.photoLabel}
        </label>
        <input
          id="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={actions.upload.isPending}
          aria-describedby={problem ? "photo-error" : undefined}
          aria-invalid={Boolean(problem)}
          className="block min-h-11 w-full min-w-0 text-sm"
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
          <p role="status" className="text-sm">
            {text.photoUploading}
          </p>
        ) : null}
        {problem ? (
          <p id="photo-error" role="alert" className="text-sm font-medium text-destructive" data-error="photo">
            {problem}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="history-title" className="space-y-2">
        <h2 id="history-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.history}
        </h2>
        <ul className="space-y-1 text-sm" data-history>
          {visit.history.map((entry, index) => (
            <li key={index}>{format(messages.visits.customer.historyLine, { action: actionLabel(entry.action), date: day(entry.created_at) })}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
