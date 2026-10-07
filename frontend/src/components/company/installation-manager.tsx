"use client";

import { BackLink } from "@/components/ui/back-link";
import { CircleAlert, CircleCheck, Eye, Lock, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { InternalNotes, SharedNow, ShareForm } from "@/components/company/installation-share";
import { StaffVisits } from "@/components/visits/staff-visits";
import { StaffGate } from "@/components/company/staff-gate";
import { QueryState } from "@/components/query-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusNote } from "@/components/ui/status-note";
import { DialLoader } from "@/components/ui/dial-loader";
import { PageHeader } from "@/components/ui/page-header";
import type { ApiError } from "@/lib/api/errors";
import { useCompanyInstallation, useDownloadEvidence, useMoveMilestone, useUploadEvidence } from "@/lib/installations/hooks";
import { updatesFor } from "@/lib/installations/timeline";
import { evidenceProblem } from "@/lib/installations/evidence";
import { currentStepText, progressText, stepName } from "@/lib/installations/progress";
import {
  type Attempt,
  evidenceLabel,
  refusalText,
  REQUIRED_EVIDENCE,
  type StepRow,
  stepActions,
  validateComplete,
  validateReset,
} from "@/lib/installations/staff";
import { format, messages } from "@/messages";

const text = messages.company.installations;
const statuses = messages.tracking.statuses;

/** One installation for the company: its steps, and the forms that move them forward. */
export function InstallationManager({ id }: { id: string }) {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <PageHeader eyebrow={text.detailEyebrow} title={text.detailTitle} />
      <Alert variant="info" role="note" data-customer-sees>
        <Eye aria-hidden />
        <AlertDescription className="text-ink">{text.customerSees}</AlertDescription>
      </Alert>
      <StaffGate basePath={`/company/installations/${id}`}>{(company) => <Manager companyId={company.company_id} id={id} />}</StaffGate>
    </div>
  );
}

function Manager({ companyId, id }: { companyId: string; id: string }) {
  const query = useCompanyInstallation(companyId, id);
  const move = useMoveMilestone(companyId, id);
  const busy = useRef(false);
  const [refused, setRefused] = useState<{ attempt: Attempt; stepId: string } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);

  const steps: StepRow[] = query.data ? [...query.data.milestones].sort((a, b) => a.position - b.position) : [];

  const run = (attempt: Attempt, step: StepRow, body: Parameters<typeof move.mutate>[0]["body"]) => {
    // A synchronous guard: state updates are too slow to stop a rapid second click.
    if (busy.current) return;
    busy.current = true;
    setRefused(null);
    setError(null);
    setDone(null);
    move.mutate(
      { milestoneId: step.id, body },
      {
        onSuccess: (result) => {
          busy.current = false;
          setDone(format(text.done, { step: stepName(step.kind), status: statuses[result.status] ?? result.status }));
          setTimeout(() => doneRef.current?.focus(), 0);
        },
        onError: (failure) => {
          busy.current = false;
          if (failure.status === 409 || failure.status === 404) setRefused({ attempt, stepId: step.id });
          else setError(failure);
        },
      },
    );
  };

  return (
    <>
      <BackLink href={`/company/installations?company=${companyId}`}>{text.back}</BackLink>
      {done ? (
        <Alert ref={doneRef as never} variant="success" tabIndex={-1} role="status" className="outline-none" data-done>
          <CircleCheck aria-hidden />
          <AlertDescription>{done}</AlertDescription>
        </Alert>
      ) : null}
      {error ? <ApiErrorMessage error={error} /> : null}
      <QueryState query={query}>
        {(installation) => (
          <section aria-labelledby="steps-title" className="space-y-4">
            <h2 id="steps-title" className="type-heading text-ink">
              {text.stepsTitle}
            </h2>
            <p className="type-body font-medium text-ink" data-progress>
              <span className="block">{progressText(steps.filter((s) => s.status === "completed").length, steps.length)}</span>
              <span className="block">{currentStepText(installation.milestones)}</span>
            </p>
            <ol className="space-y-3">
              {steps.map((step) => (
                <li key={step.id} className="space-y-4 rounded-card border border-line bg-surface p-5 text-sm shadow-e1" data-step={step.status}>
                  <h3 className="type-subheading flex flex-wrap items-center gap-3 text-ink">
                    {stepName(step.kind)}
                    <Badge variant={step.status === "completed" ? "success" : step.status === "in_progress" ? "info" : "neutral"}>{statuses[step.status] ?? step.status}</Badge>
                  </h3>
                  {refused?.stepId === step.id ? (
                    <Alert variant="warning" role="alert" data-refused>
                      <TriangleAlert aria-hidden />
                      <AlertDescription>{refusalText(refused.attempt, step, steps)}</AlertDescription>
                    </Alert>
                  ) : null}
                  <SharedNow updates={updatesFor(installation.history, step.id)} now={query.dataUpdatedAt} />
                  <StepForms companyId={companyId} installationId={id} step={step} steps={steps} pending={move.isPending} run={run} />
                  {step.status !== "completed" ? <ShareForm companyId={companyId} installationId={id} milestoneId={step.id} now={query.dataUpdatedAt} /> : null}
                  {step.evidence && step.evidence.length > 0 ? <EvidenceList companyId={companyId} installationId={id} items={[...step.evidence]} /> : null}
                </li>
              ))}
            </ol>
          </section>
        )}
      </QueryState>
      <StaffVisits companyId={companyId} installationId={id} />
      <InternalNotes companyId={companyId} installationId={id} />
    </>
  );
}

function StepForms({ companyId, installationId, step, steps, pending, run }: { companyId: string; installationId: string; step: StepRow; steps: StepRow[]; pending: boolean; run: (attempt: Attempt, step: StepRow, body: { status: "pending" | "in_progress" | "completed"; evidence?: { kind: string; asset_id: string }[]; reason?: string }) => void }) {
  const actions = stepActions(step, steps);
  const upload = useUploadEvidence(companyId, installationId);
  const [assetId, setAssetId] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploadProblem, setUploadProblem] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [completeErrors, setCompleteErrors] = useState<Record<string, string>>({});
  const [resetErrors, setResetErrors] = useState<Record<string, string>>({});
  const evidenceKind = REQUIRED_EVIDENCE[step.kind] ?? "";
  const id = step.id;

  if (actions.final) {
    return (
      <p className="text-ink-2" data-final>
        {text.finalNote}
      </p>
    );
  }
  if (step.status === "pending") {
    return (
      <div className="space-y-2">
        {actions.start === "yes" ? (
          <Button
            type="button"
            aria-disabled={pending}
            data-action="start"
            onClick={() => {
              if (pending) return;
              run("start", step, { status: "in_progress" });
            }}
          >
            {pending ? text.startWorking : text.start}
          </Button>
        ) : (
          <p className="text-ink-2" data-waiting>
            {format(text.waiting, { previous: actions.waitingFor ?? "" })}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <form
        noValidate
        aria-labelledby={`${id}-complete`}
        className="space-y-3 rounded-card border border-line bg-paper p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending || upload.isPending) return;
          const errors = validateComplete({ assetId, note });
          setCompleteErrors(errors);
          if (Object.keys(errors).length > 0) return;
          run("complete", step, { status: "completed", evidence: [{ kind: evidenceKind, asset_id: assetId.trim() }], reason: note.trim() || undefined });
        }}
      >
        <h4 id={`${id}-complete`} className="type-subheading text-ink">
          {text.completeTitle}
        </h4>
        <p className="text-ink-2">{text.completeIntro}</p>
        <div className="space-y-1">
          <label htmlFor={`${id}-asset`} className="block font-medium text-ink">
            {format(text.evidenceField, { kind: evidenceLabel(evidenceKind) })}
          </label>
          <input
            id={`${id}-asset`}
            type="file"
            className="field-control block min-h-11 w-full min-w-0 cursor-pointer p-2 text-sm file:mr-3 file:min-h-9 file:cursor-pointer file:rounded-full file:border-0 file:bg-paper-2 file:px-4 file:font-medium file:text-ink"
            accept="image/jpeg,image/png,image/webp"
            disabled={upload.isPending}
            aria-invalid={Boolean(completeErrors.assetId || uploadProblem)}
            aria-describedby={`${id}-asset-help${completeErrors.assetId || uploadProblem ? ` ${id}-asset-error` : ""}`}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setUploadProblem(evidenceProblem(file));
              if (evidenceProblem(file)) return;
              setCompleteErrors({});
              upload.mutate(file, {
                onSuccess: (result) => {
                  setAssetId(result.id ?? "");
                  setFileName(file.name);
                  setUploadProblem(null);
                },
                onError: (failure) => setUploadProblem(failure.status === 422 || failure.status === 409 ? text.upload.refused : failure.message),
              });
            }}
          />
          <p id={`${id}-asset-help`} className="text-ink-2">
            {text.evidenceHelp}
          </p>
          {upload.isPending ? (
            <p role="status" className="flex items-center gap-2 text-ink" data-uploading>
              <DialLoader className="size-5 text-orange-text" />
              {text.upload.working}
            </p>
          ) : null}
          {assetId && fileName ? (
            <StatusNote tone="success" data-uploaded>
              {format(text.upload.done, { name: fileName })}
            </StatusNote>
          ) : null}
          {completeErrors.assetId || uploadProblem ? (
            <p id={`${id}-asset-error`} className="flex items-center gap-1.5 font-medium text-danger" data-error="asset">
              <CircleAlert aria-hidden className="size-4 shrink-0" />
              {uploadProblem ?? completeErrors.assetId}
            </p>
          ) : null}
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-note`} className="block font-medium text-ink">
            {text.noteField}
          </label>
          <textarea
            id={`${id}-note`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            aria-describedby={`${id}-note-help`}
            className="w-full field-control p-3"
          />
          <p id={`${id}-note-help`} className="text-ink-2">
            {text.noteHelp}
          </p>
          {completeErrors.note ? (
            <p className="flex items-center gap-1.5 font-medium text-danger" data-error="note">
              <CircleAlert aria-hidden className="size-4 shrink-0" />
              {completeErrors.note}
            </p>
          ) : null}
        </div>
        <Button type="submit" aria-disabled={pending || upload.isPending} data-action="complete">
          {pending ? text.completeWorking : text.complete}
        </Button>
      </form>
      <form
        noValidate
        aria-labelledby={`${id}-reset`}
        className="space-y-3 rounded-card border border-line bg-paper p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const errors = validateReset({ reason });
          setResetErrors(errors);
          if (Object.keys(errors).length > 0) return;
          run("reset", step, { status: "pending", reason: reason.trim() });
        }}
      >
        <h4 id={`${id}-reset`} className="type-subheading text-ink">
          {text.resetTitle}
        </h4>
        <label htmlFor={`${id}-reason`} className="block font-medium text-ink">
          {text.resetField}
        </label>
        <textarea
          id={`${id}-reason`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          aria-invalid={Boolean(resetErrors.reason)}
          aria-describedby={`${id}-reason-help${resetErrors.reason ? ` ${id}-reason-error` : ""}`}
          className="w-full field-control p-3"
        />
        <p id={`${id}-reason-help`} className="text-ink-2">
          {text.resetHelp}
        </p>
        {resetErrors.reason ? (
          <p id={`${id}-reason-error`} className="flex items-center gap-1.5 font-medium text-danger" data-error="reason">
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {resetErrors.reason}
          </p>
        ) : null}
        <Button type="submit" variant="outline" aria-disabled={pending} data-action="reset">
          {pending ? text.resetWorking : text.reset}
        </Button>
      </form>
    </div>
  );
}

/** Evidence already on file for a completed step, each one opened only through the access-checked download. */
function EvidenceList({ companyId, installationId, items }: { companyId: string; installationId: string; items: { kind: string; asset_id: string }[] }) {
  const download = useDownloadEvidence(companyId, installationId);
  return (
    <div className="space-y-2 rounded-field border border-line bg-paper-2 p-4" data-evidence-list>
      <h4 className="flex items-center gap-2 font-medium text-ink"><Lock aria-hidden className="size-4 text-ink-3" />{text.upload.attached}</h4>
      <p className="text-ink-2">{text.upload.privateNote}</p>
      <ul className="flex flex-wrap gap-3">
        {items.map((item) => (
          <li key={item.asset_id}>
            <Button type="button" variant="outline" aria-disabled={download.isPending} data-download={item.kind} onClick={() => !download.isPending && download.mutate(item.asset_id)}>
              {download.isPending && download.variables === item.asset_id ? text.upload.downloading : format(text.upload.download, { kind: evidenceLabel(item.kind) })}
            </Button>
          </li>
        ))}
      </ul>
      {download.error ? <ApiErrorMessage error={download.error} /> : null}
    </div>
  );
}
