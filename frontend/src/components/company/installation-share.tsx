"use client";

import { Lock } from "lucide-react";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { QueryState } from "@/components/query-state";
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
    <div className="space-y-1 rounded-md border p-2" data-shared-now>
      <p className="text-xs font-medium">{share.badge}</p>
      {schedule ? (
        <>
          {schedule.nextAction ? <p>{format(tracking.nextAction, { action: schedule.nextAction })}</p> : null}
          {schedule.delayUntil ? <p>{format(schedule.delayed ? tracking.delayedUntil : tracking.wasDelayedUntil, { date: date(schedule.delayUntil) })}</p> : null}
        </>
      ) : (
        <p className="text-muted-foreground">{share.none}</p>
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
      <p id={`${id}-${key}-error`} className="font-medium text-destructive" data-error={key}>
        {errors[key]}
      </p>
    ) : null;

  return (
    <form
      noValidate
      aria-labelledby={`${id}-title`}
      className="space-y-2 rounded-lg border p-3"
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
      <div className="flex flex-wrap items-center gap-2">
        <h4 id={`${id}-title`} className="font-medium">
          {share.title}
        </h4>
        <span className="rounded-full border border-foreground px-2 py-0.5 text-xs font-medium" data-badge="shared">
          {share.badge}
        </span>
      </div>
      <p className="text-muted-foreground">{share.intro}</p>
      {Object.keys(errors).length > 0 ? (
        <div ref={summary} tabIndex={-1} role="alert" className="font-medium outline-none" data-error-summary>
          <p>{share.summary}</p>
          <ul className="list-disc pl-5">
            {Object.entries(errors).map(([key, message]) => (
              <li key={key}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="space-y-1">
        <label htmlFor={`${id}-reason`} className="block font-medium">{share.reason}</label>
        <textarea id={`${id}-reason`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border bg-transparent p-2" {...field("reason")} />
        <p id={`${id}-reason-help`} className="text-muted-foreground">{share.reasonHelp}</p>
        {problem("reason")}
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-nextAction`} className="block font-medium">{share.nextAction}</label>
        <textarea id={`${id}-nextAction`} rows={2} value={nextAction} onChange={(e) => setNextAction(e.target.value)} className="w-full rounded-lg border bg-transparent p-2" {...field("nextAction")} />
        <p id={`${id}-nextAction-help`} className="text-muted-foreground">{share.nextActionHelp}</p>
        {problem("nextAction")}
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-delayDate`} className="block font-medium">{share.delayDate}</label>
        <input id={`${id}-delayDate`} type="date" value={delayDate} onChange={(e) => setDelayDate(e.target.value)} className="h-11 rounded-lg border bg-transparent px-2" {...field("delayDate")} />
        <p id={`${id}-delayDate-help`} className="text-muted-foreground">{share.delayHelp}</p>
        {problem("delayDate")}
      </div>
      <Button type="submit" variant="outline" aria-disabled={mutation.isPending} data-action="share">
        {mutation.isPending ? share.sending : share.send}
      </Button>
      {sent ? (
        <p role="status" className="font-medium" data-share-sent>
          {share.sent}
        </p>
      ) : null}
      {refused ? (
        <p role="alert" className="font-medium" data-refused>
          {share.failed}
        </p>
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
    <section aria-labelledby="internal-title" className="space-y-3 rounded-lg border-2 border-dashed bg-muted/40 p-4" data-internal-section>
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="internal-title" className="font-heading text-xl font-semibold tracking-tight">
          {internal.title}
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-foreground px-2 py-0.5 text-xs font-medium" data-badge="internal">
          <Lock aria-hidden className="size-3" />
          {internal.badge}
        </span>
      </div>
      <p className="text-sm">{internal.intro}</p>
      <QueryState query={query} isEmpty={(notes) => notes.length === 0} empty={<p className="text-sm text-muted-foreground" data-no-notes>{internal.empty}</p>}>
        {(notes) => (
          <ul className="space-y-3" data-notes>
            {notes.map((note) => (
              <li key={note.id} className="space-y-1 rounded-md border bg-background p-3 text-sm" data-note>
                <p className="text-xs text-muted-foreground">
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
        <label htmlFor="internal-body" className="block font-medium">{internal.add}</label>
        <textarea
          id="internal-body"
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          aria-invalid={Boolean(problem)}
          aria-describedby={`internal-help${problem ? " internal-error" : ""}`}
          className="w-full rounded-lg border bg-background p-2"
        />
        <p id="internal-help" className="text-muted-foreground">{internal.addHelp}</p>
        {problem ? (
          <p id="internal-error" className="font-medium text-destructive" data-error="note">
            {problem}
          </p>
        ) : null}
        <Button type="submit" aria-disabled={add.isPending} data-action="add-note">
          {add.isPending ? internal.saving : internal.save}
        </Button>
        {saved ? (
          <p role="status" className="font-medium" data-note-saved>
            {internal.saved}
          </p>
        ) : null}
        {failure ? <ApiErrorMessage error={failure} /> : null}
      </form>
    </section>
  );
}
