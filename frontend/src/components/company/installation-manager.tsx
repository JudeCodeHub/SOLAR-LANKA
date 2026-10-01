"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { StaffGate } from "@/components/company/staff-gate";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api/errors";
import { useCompanyInstallation, useDownloadEvidence, useMoveMilestone, useUploadEvidence } from "@/lib/installations/hooks";
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
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.detailTitle}</h1>
      <p className="rounded-lg border p-3 text-sm" data-customer-sees>
        {text.customerSees}
      </p>
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
      <Link href={`/company/installations?company=${companyId}`} className="text-sm underline underline-offset-2">
        {text.back}
      </Link>
      {done ? (
        <p ref={doneRef} tabIndex={-1} role="status" className="text-sm font-medium outline-none" data-done>
          {done}
        </p>
      ) : null}
      {error ? <ApiErrorMessage error={error} /> : null}
      <QueryState query={query}>
        {(installation) => (
          <section aria-labelledby="steps-title" className="space-y-3">
            <h2 id="steps-title" className="font-heading text-xl font-semibold tracking-tight">
              {text.stepsTitle}
            </h2>
            <p className="text-sm font-medium" data-progress>
              <span className="block">{progressText(steps.filter((s) => s.status === "completed").length, steps.length)}</span>
              <span className="block">{currentStepText(installation.milestones)}</span>
            </p>
            <ol className="space-y-3">
              {steps.map((step) => (
                <li key={step.id} className="space-y-3 rounded-lg border p-3 text-sm" data-step={step.status}>
                  <h3 className="font-medium">
                    {stepName(step.kind)}
                    <span className="ml-2 rounded-full border px-2 py-0.5 text-xs font-normal">{statuses[step.status] ?? step.status}</span>
                  </h3>
                  {refused?.stepId === step.id ? (
                    <p role="alert" className="font-medium" data-refused>
                      {refusalText(refused.attempt, step, steps)}
                    </p>
                  ) : null}
                  <StepForms companyId={companyId} installationId={id} step={step} steps={steps} pending={move.isPending} run={run} />
                  {step.evidence && step.evidence.length > 0 ? <EvidenceList companyId={companyId} installationId={id} items={[...step.evidence]} /> : null}
                </li>
              ))}
            </ol>
          </section>
        )}
      </QueryState>
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
      <p className="text-muted-foreground" data-final>
        {text.finalNote}
      </p>
    );
  }
  if (step.status === "pending") {
    return (
      <div className="space-y-1">
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
          <p className="text-muted-foreground" data-waiting>
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
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending || upload.isPending) return;
          const errors = validateComplete({ assetId, note });
          setCompleteErrors(errors);
          if (Object.keys(errors).length > 0) return;
          run("complete", step, { status: "completed", evidence: [{ kind: evidenceKind, asset_id: assetId.trim() }], reason: note.trim() || undefined });
        }}
      >
        <h4 id={`${id}-complete`} className="font-medium">
          {text.completeTitle}
        </h4>
        <p className="text-muted-foreground">{text.completeIntro}</p>
        <div className="space-y-1">
          <label htmlFor={`${id}-asset`} className="block font-medium">
            {format(text.evidenceField, { kind: evidenceLabel(evidenceKind) })}
          </label>
          <input
            id={`${id}-asset`}
            type="file"
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
          <p id={`${id}-asset-help`} className="text-muted-foreground">
            {text.evidenceHelp}
          </p>
          {upload.isPending ? (
            <p role="status" data-uploading>
              {text.upload.working}
            </p>
          ) : null}
          {assetId && fileName ? (
            <p role="status" className="font-medium" data-uploaded>
              {format(text.upload.done, { name: fileName })}
            </p>
          ) : null}
          {completeErrors.assetId || uploadProblem ? (
            <p id={`${id}-asset-error`} className="font-medium text-destructive" data-error="asset">
              {uploadProblem ?? completeErrors.assetId}
            </p>
          ) : null}
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-note`} className="block font-medium">
            {text.noteField}
          </label>
          <textarea
            id={`${id}-note`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            aria-describedby={`${id}-note-help`}
            className="w-full rounded-lg border bg-transparent p-2"
          />
          <p id={`${id}-note-help`} className="text-muted-foreground">
            {text.noteHelp}
          </p>
          {completeErrors.note ? (
            <p className="font-medium text-destructive" data-error="note">
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
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const errors = validateReset({ reason });
          setResetErrors(errors);
          if (Object.keys(errors).length > 0) return;
          run("reset", step, { status: "pending", reason: reason.trim() });
        }}
      >
        <h4 id={`${id}-reset`} className="font-medium">
          {text.resetTitle}
        </h4>
        <label htmlFor={`${id}-reason`} className="block font-medium">
          {text.resetField}
        </label>
        <textarea
          id={`${id}-reason`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          aria-invalid={Boolean(resetErrors.reason)}
          aria-describedby={`${id}-reason-help${resetErrors.reason ? ` ${id}-reason-error` : ""}`}
          className="w-full rounded-lg border bg-transparent p-2"
        />
        <p id={`${id}-reason-help`} className="text-muted-foreground">
          {text.resetHelp}
        </p>
        {resetErrors.reason ? (
          <p id={`${id}-reason-error`} className="font-medium text-destructive" data-error="reason">
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
    <div className="space-y-1" data-evidence-list>
      <h4 className="font-medium">{text.upload.attached}</h4>
      <p className="text-muted-foreground">{text.upload.privateNote}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.asset_id}>
            <Button type="button" variant="outline" size="sm" aria-disabled={download.isPending} data-download={item.kind} onClick={() => !download.isPending && download.mutate(item.asset_id)}>
              {download.isPending && download.variables === item.asset_id ? text.upload.downloading : format(text.upload.download, { kind: evidenceLabel(item.kind) })}
            </Button>
          </li>
        ))}
      </ul>
      {download.error ? <ApiErrorMessage error={download.error} /> : null}
    </div>
  );
}
