"use client";

import { CircleAlert, TriangleAlert, UserCheck, UserX } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

import { PlatformGate } from "@/components/admin/platform-gate";
import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import type { ApiError } from "@/lib/api/errors";
import { useSetAccountStatus } from "@/lib/admin/hooks";
import { type AccountAction, accountProblem, accountRefusal, shortId } from "@/lib/admin/review";
import { format, messages } from "@/messages";

const text = messages.admin.users;

/** Suspend or restore an account by id, using the platform administrator's real backend permission. */
export function AccountAccess() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      <PlatformGate>{(selfId) => <AccountForm selfId={selfId} />}</PlatformGate>
    </div>
  );
}

/** The id box and the two actions; an id that cannot be used is refused on the page before any question is asked. */
export function AccountForm({ selfId }: { selfId: string }) {
  const [targetId, setTargetId] = useState(useSearchParams().get("user") ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; suspended: boolean; provider: string } | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const mutation = useSetAccountStatus();
  const busy = useRef(false);
  const resultRef = useRef<HTMLParagraphElement>(null);
  const id = targetId.trim();

  // The check runs when an action is chosen, so the confirmation is only offered for an id that can be used.
  const guard = (action: AccountAction) => {
    const found = accountProblem({ targetId, selfId, action });
    setProblem(found);
    return found === null;
  };
  const run = (action: AccountAction) => {
    // A synchronous guard: state updates are too slow to stop a rapid second click.
    if (busy.current || !guard(action)) return;
    busy.current = true;
    setRefused(null);
    setError(null);
    setResult(null);
    mutation.mutate(
      { id, suspended: action === "suspend" },
      {
        onSuccess: (view) => {
          busy.current = false;
          setResult({ id: view.id, suspended: view.is_suspended, provider: view.provider_state });
          setTimeout(() => resultRef.current?.focus(), 0);
        },
        onError: (failure) => {
          busy.current = false;
          if (failure.status === 404) setRefused(text.notFound);
          else if (failure.status === 409) setRefused(accountRefusal(action));
          else setError(failure);
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6">
        <label htmlFor="account-id" className="type-subheading block text-ink">
          {text.idLabel}
        </label>
        <input
          id="account-id"
          value={targetId}
          onChange={(event) => {
            setTargetId(event.target.value);
            setProblem(null);
          }}
          aria-invalid={Boolean(problem)}
          aria-describedby={`account-id-help${problem ? " account-id-error" : ""}`}
          autoComplete="off"
          spellCheck={false}
          className="field-control h-11 w-full px-3.5 font-mono text-sm"
        />
        <p id="account-id-help" className="type-small text-ink-2">
          {text.idHelp}
        </p>
        {problem ? (
          <p id="account-id-error" role="alert" className="flex items-center gap-1.5 text-sm font-medium text-danger" data-error="id">
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {problem}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" data-account-actions>
        <ConfirmAction
          id="suspend"
          label={mutation.isPending ? text.working : text.suspend}
          title={format(text.suspendTitle, { id: shortId(id) })}
          body={text.suspendBody}
          yes={text.suspendYes}
          keep={text.keep}
          disabled={mutation.isPending}
          onConfirm={() => run("suspend")}
          onBeforeOpen={() => guard("suspend")}
        />
        <ConfirmAction
          id="restore"
          label={mutation.isPending ? text.working : text.restore}
          title={format(text.restoreTitle, { id: shortId(id) })}
          body={text.restoreBody}
          yes={text.restoreYes}
          keep={text.keep}
          disabled={mutation.isPending}
          onConfirm={() => run("restore")}
          onBeforeOpen={() => guard("restore")}
        />
      </div>
      {result ? (
        <Alert ref={resultRef as never} variant={result.suspended ? "warning" : "success"} tabIndex={-1} role="status" className="outline-none" data-result>
          {result.suspended ? <UserX aria-hidden /> : <UserCheck aria-hidden />}
          <AlertDescription className="space-y-1 text-ink">
            <p className="font-medium">{format(result.suspended ? text.resultSuspended : text.resultActive, { id: shortId(result.id) })}</p>
            <p className="text-ink-2">{format(text.provider, { state: result.provider })}</p>
          </AlertDescription>
        </Alert>
      ) : null}
      {refused ? (
        <Alert variant="warning" role="alert" data-refused>
          <TriangleAlert aria-hidden />
          <AlertDescription>{refused}</AlertDescription>
        </Alert>
      ) : null}
      {error ? <ApiErrorMessage error={error} /> : null}
    </div>
  );
}
