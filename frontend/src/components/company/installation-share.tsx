"use client";

import { CircleAlert, CircleCheck, Eye, Lock, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { QueryState } from "@/components/query-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/api/hooks";
import type { ApiError } from "@/lib/api/errors";
import { formatLongDate } from "@/lib/catalogue/detail";
import { noteAuthor } from "@/lib/inbox/inbox";
import { useAddInstallationNote, useInstallationNotes, useShareUpdate } from "@/lib/installations/hooks";
import { scheduleBody, validateInstallationNote, validateSchedule } from "@/lib/installations/schedule";
import { scheduleFor, type UpdateLike } from "@/lib/installations/timeline";
import { format, messages } from "@/messages";

const share = messages.company.installations.share;
const internal = messages.company.installations.internal;
const tracking = messages.tracking.timeline;
const date = (iso: string) => formatLongDate(iso) ?? iso;

/** What the customer currently sees about this step's schedule, so staff know what has been shared. */
export function SharedNow({ updates, now }: { updates: UpdateLike[]; now: number }) {
  const schedule = scheduleFor(updates, now);
  return (
    <div className="space-y-1 rounded-field border border-info bg-info-tint p-3 text-ink" data-shared-now>
      <p className="flex items-center gap-1.5 text-xs font-semibold"><Eye aria-hidden className="size-3.5" />{share.badge}</p>
      {schedule ? (
        <>
          {schedule.nextAction ? <p>{format(tracking.nextAction, { action: schedule.nextAction })}</p> : null}
          {schedule.delayUntil ? <p>{format(schedule.delayed ? tracking.delayedUntil : tracking.wasDelayedUntil, { date: date(schedule.delayUntil) })}</p> : null}
        </>
      ) : (
        <p className="text-ink-2">{share.none}</p>
      )}
    </div>
  );
}

/** Share a delay or next action with the customer, clearly marked as customer-visible. */
export function ShareForm({ companyId, installationId, milestoneId, now }: { companyId: string; installationId: string; milestoneId: string; now: number }) {
  const mutation = useShareUpdate(companyId, installationId);
  const busy = useRef(false);
  const summary = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [delayDate, setDelayDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [refused, setRefused] = useState(false);
  const id = `share-${milestoneId}`;

  const field = (key: string) => ({
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": `${id}-${key}-help${errors[key] ? ` ${id}-${key}-error` : ""}`,
  });
  const problem = (key: string) =>
    errors[key] ? (
      <p id={`${id}-${key}-error`} className="flex items-center gap-1.5 font-medium text-danger" data-error={key}>
        <CircleAlert aria-hidden className="size-4 shrink-0" />
        {errors[key]}
      </p>
    ) : null;

  return (
    <form
      noValidate
      aria-labelledby={`${id}-title`}
      className="space-y-3 rounded-card border-2 border-info bg-surface p-4"
      data-share-form
      onSubmit={(event) => {
        event.preventDefault();
        // A synchronous guard: state updates are too slow to stop a rapid second click.
        if (busy.current || mutation.isPending) return;
        const input = { reason, nextAction, delayDate };
        const found = validateSchedule(input, now);
        setErrors(found);
        setSent(false);
        setFailure(null);
        setRefused(false);
        if (Object.keys(found).length > 0) {
          setTimeout(() => summary.current?.focus(), 0);
          return;
        }
        busy.current = true;
        mutation.mutate(
          { milestoneId, body: scheduleBody(input) },
          {
            onSuccess: () => {
              busy.current = false;
              setReason("");
              setNextAction("");
              setDelayDate("");
              setSent(true);
            },
            onError: (error) => {
              busy.current = false;
              if (error.status === 404 || error.status === 409) setRefused(true);
              else setFailure(error);
            },
          },
        );
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h4 id={`${id}-title`} className="type-subheading text-ink">
          {share.title}
        </h4>
        <Badge variant="info" icon={Eye} data-badge="shared">
          {share.badge}
        </Badge>
      </div>
      <p className="text-ink-2">{share.intro}</p>
      {Object.keys(errors).length > 0 ? (
        <div ref={summary} tabIndex={-1} role="alert" className="rounded-field border-2 border-danger bg-danger-tint p-3 font-medium text-ink outline-none" data-error-summary>
          <p>{share.summary}</p>
          <ul className="list-disc pl-5">
            {Object.entries(errors).map(([key, message]) => (
              <li key={key}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="space-y-1">
        <label htmlFor={`${id}-reason`} className="block font-medium text-ink">{share.reason}</label>
        <textarea id={`${id}-reason`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full field-control p-3" {...field("reason")} />
        <p id={`${id}-reason-help`} className="text-ink-2">{share.reasonHelp}</p>
        {problem("reason")}
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-nextAction`} className="block font-medium text-ink">{share.nextAction}</label>
        <textarea id={`${id}-nextAction`} rows={2} value={nextAction} onChange={(e) => setNextAction(e.target.value)} className="w-full field-control p-3" {...field("nextAction")} />
        <p id={`${id}-nextAction-help`} className="text-ink-2">{share.nextActionHelp}</p>
        {problem("nextAction")}
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-delayDate`} className="block font-medium text-ink">{share.delayDate}</label>
        <input id={`${id}-delayDate`} type="date" value={delayDate} onChange={(e) => setDelayDate(e.target.value)} className="h-11 field-control px-3" {...field("delayDate")} />
        <p id={`${id}-delayDate-help`} className="text-ink-2">{share.delayHelp}</p>
        {problem("delayDate")}
      </div>
      <Button type="submit" aria-disabled={mutation.isPending} data-action="share">
        {mutation.isPending ? share.sending : share.send}
      </Button>
      {sent ? (
        <p role="status" className="flex items-center gap-2 font-medium text-ink" data-share-sent>
          <CircleCheck aria-hidden className="size-4 text-success" />
          {share.sent}
        </p>
      ) : null}
      {refused ? (
        <Alert variant="warning" role="alert" data-refused>
          <TriangleAlert aria-hidden />
          <AlertDescription>{share.failed}</AlertDescription>
        </Alert>
      ) : null}
      {failure ? <ApiErrorMessage error={failure} /> : null}
    </form>
  );
}

/** Notes for the company's staff only, set apart from everything the customer sees. */
export function InternalNotes({ companyId, installationId }: { companyId: string; installationId: string }) {
  const query = useInstallationNotes(companyId, installationId);
  const add = useAddInstallationNote(companyId, installationId);
  const me = useCurrentUser();
  const busy = useRef(false);
  const [body, setBody] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);

  return (
    <section aria-labelledby="internal-title" className="space-y-3 rounded-card border-2 border-dashed border-ink-3 bg-paper-2 p-5 sm:p-6" data-internal-section>
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="internal-title" className="type-heading text-ink">
          {internal.title}
        </h2>
        <Badge variant="neutral" icon={Lock} className="border-ink-3 font-semibold text-ink" data-badge="internal">
          {internal.badge}
        </Badge>
      </div>
      <p className="type-small text-ink">{internal.intro}</p>
      <QueryState query={query} isEmpty={(notes) => notes.length === 0} empty={<p className="type-body text-ink-2" data-no-notes>{internal.empty}</p>}>
        {(notes) => (
          <ul className="space-y-3" data-notes>
            {notes.map((note) => (
              <li key={note.id} className="space-y-1 rounded-field border border-line bg-surface p-3 text-sm" data-note>
                <p className="text-xs text-ink-2">
                  {format(internal.byline, { badge: internal.badge, who: noteAuthor(note.actor_id, me.data?.id), date: date(note.created_at) })}
                </p>
                <p className="whitespace-pre-wrap">{note.body}</p>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      <form
        noValidate
        className="space-y-2 text-sm"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy.current || add.isPending) return;
          const found = validateInstallationNote(body);
          setProblem(found);
          setSaved(false);
          setFailure(null);
          if (found) return;
          busy.current = true;
          add.mutate(body.trim(), {
            onSuccess: () => {
              busy.current = false;
              setBody("");
              setSaved(true);
            },
            onError: (error) => {
              busy.current = false;
              setFailure(error);
            },
          });
        }}
      >
        <label htmlFor="internal-body" className="block font-medium text-ink">{internal.add}</label>
        <textarea
          id="internal-body"
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          aria-invalid={Boolean(problem)}
          aria-describedby={`internal-help${problem ? " internal-error" : ""}`}
          className="field-control w-full p-3"
        />
        <p id="internal-help" className="text-ink-2">{internal.addHelp}</p>
        {problem ? (
          <p id="internal-error" className="flex items-center gap-1.5 font-medium text-danger" data-error="note">
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {problem}
          </p>
        ) : null}
        <Button type="submit" aria-disabled={add.isPending} data-action="add-note">
          {add.isPending ? internal.saving : internal.save}
        </Button>
        {saved ? (
          <p role="status" className="flex items-center gap-2 font-medium text-ink" data-note-saved>
            <CircleCheck aria-hidden className="size-4 text-success" />
            {internal.saved}
          </p>
        ) : null}
        {failure ? <ApiErrorMessage error={failure} /> : null}
      </form>
    </section>
  );
}
