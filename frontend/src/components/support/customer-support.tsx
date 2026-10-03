"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { PhotoList } from "@/components/support/photo-list";
import { UpdatesList } from "@/components/support/updates-list";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api/errors";
import { formatLongDate } from "@/lib/catalogue/detail";
import { evidenceProblem } from "@/lib/installations/evidence";
import { customerMoves, newKey, statusLabel } from "@/lib/support/support";
import { customerPhoto, useCustomerSupport, useMyCase, useMyCases, useMyInstallations, useMyUpdates, useOpenCase } from "@/lib/support/hooks";
import { format, messages } from "@/messages";

const text = messages.support.customer;
const safety = messages.support.safety;

function SafetyBox() {
  return (
    <section aria-labelledby="safety-title" className="space-y-1 rounded-lg border-2 border-destructive p-3 text-sm" data-safety>
      <h2 id="safety-title" className="font-semibold">
        {safety.title}
      </h2>
      <p>{safety.body}</p>
    </section>
  );
}

/** The customer's support requests, and a form to report a problem. */
export function CustomerSupport() {
  const product = useSearchParams().get("product");
  const cases = useMyCases();
  const installations = useMyInstallations();
  const open = useOpenCase();
  const busy = useRef(false);
  const [installation, setInstallation] = useState("");
  const [symptom, setSymptom] = useState("");
  const [code, setCode] = useState("");
  const [unsafe, setUnsafe] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [sent, setSent] = useState<{ id: string; unsafe: boolean } | null>(null);
  const chosen = installation || (installations.data?.items.length === 1 ? (installations.data.items[0]?.id ?? "") : "");

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      <SafetyBox />
      <Link href="/troubleshooting" className="inline-flex min-h-11 items-center font-medium underline underline-offset-2">
        {text.troubleshoot}
      </Link>
      {sent ? (
        <div role="status" className="space-y-1 text-sm font-medium" data-sent>
          <p>{text.opened}</p>
          {sent.unsafe ? <p>{safety.body}</p> : null}
          <Link href={`/my/support/${sent.id}`} className="inline-flex min-h-11 items-center underline underline-offset-2">
            {text.back}
          </Link>
        </div>
      ) : null}
      <QueryState query={cases} isEmpty={(items) => items.length === 0} empty={<p className="text-sm text-muted-foreground" data-none>{text.none}</p>}>
        {(items) => (
          <ul className="space-y-2" data-cases>
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border p-3 text-sm" data-case={item.status}>
                <Link href={`/my/support/${item.id}`} className="inline-flex min-h-11 items-center font-medium underline underline-offset-2">
                  {format(text.open, { symptom: item.symptom.slice(0, 80) })}
                </Link>
                <p className="text-muted-foreground">{statusLabel(item.status)}</p>
                {item.unsafe_now ? <p className="font-medium">{safety.unsafeBox}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      <section aria-labelledby="new-title" className="space-y-3">
        <h2 id="new-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.newTitle}
        </h2>
        {installations.data && installations.data.items.length === 0 ? (
          <p className="text-sm" data-no-installations>
            {text.noInstallations}
          </p>
        ) : (
          <form
            noValidate
            className="space-y-3 text-sm"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy.current) return;
              const found: Record<string, string> = {};
              if (!chosen) found.installation = text.errors.installation;
              if (symptom.trim() === "") found.symptom = text.errors.symptom;
              setErrors(found);
              setFailure(null);
              setSent(null);
              if (Object.keys(found).length > 0) return;
              busy.current = true;
              open.mutate(
                { installation_id: chosen, product_id: product || null, symptom: symptom.trim(), observed_code: code.trim() || null, unsafe_now: unsafe },
                {
                  onSuccess: (created) => {
                    busy.current = false;
                    setSent({ id: created.id, unsafe: created.unsafe_now });
                    setSymptom("");
                    setCode("");
                    setUnsafe(false);
                  },
                  onError: (error) => {
                    busy.current = false;
                    setFailure(error);
                  },
                },
              );
            }}
          >
            {installations.data && installations.data.items.length > 1 ? (
              <div className="space-y-1">
                <label htmlFor="installation" className="block font-medium">
                  {text.installation}
                </label>
                <select id="installation" value={installation} onChange={(event) => setInstallation(event.target.value)} aria-invalid={Boolean(errors.installation)} className="h-11 rounded-lg border bg-transparent px-2">
                  <option value="">{text.installation}</option>
                  {installations.data.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {format(text.installationLine, { date: formatLongDate(item.created_at) ?? item.created_at })}
                    </option>
                  ))}
                </select>
                {errors.installation ? <p className="font-medium text-destructive" data-error="installation">{errors.installation}</p> : null}
              </div>
            ) : null}
            <div className="space-y-1">
              <label htmlFor="symptom" className="block font-medium">
                {text.symptom}
              </label>
              <textarea id="symptom" rows={4} value={symptom} maxLength={2000} onChange={(event) => setSymptom(event.target.value)} aria-invalid={Boolean(errors.symptom)} aria-describedby={`symptom-help${errors.symptom ? " symptom-error" : ""}`} className="w-full rounded-lg border bg-transparent p-2" />
              <p id="symptom-help" className="text-muted-foreground">
                {text.symptomHelp}
              </p>
              {errors.symptom ? (
                <p id="symptom-error" className="font-medium text-destructive" data-error="symptom">
                  {errors.symptom}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <label htmlFor="code" className="block font-medium">
                {text.code}
              </label>
              <input id="code" value={code} maxLength={64} onChange={(event) => setCode(event.target.value)} aria-describedby="code-help" className="h-11 w-full rounded-lg border bg-transparent px-3" />
              <p id="code-help" className="text-muted-foreground">
                {text.codeHelp}
              </p>
            </div>
            <div className="space-y-1">
              <label className="flex min-h-11 items-center gap-3 font-medium">
                <input type="checkbox" checked={unsafe} onChange={(event) => setUnsafe(event.target.checked)} aria-describedby="unsafe-help" className="size-6 shrink-0" />
                <span>{safety.unsafeBox}</span>
              </label>
              <p id="unsafe-help" className="text-muted-foreground">
                {safety.unsafeHelp}
              </p>
            </div>
            {unsafe ? (
              <p role="alert" className="font-medium" data-unsafe-warning>
                {safety.body}
              </p>
            ) : null}
            <Button type="submit" aria-disabled={open.isPending} data-action="report">
              {open.isPending ? text.sending : text.submit}
            </Button>
            {failure ? (failure.status === 409 ? <p role="alert" className="font-medium" data-limit>{text.limit}</p> : <ApiErrorMessage error={failure} />) : null}
          </form>
        )}
      </section>
    </div>
  );
}

/** One support request: what was reported, the shared updates, a message box, photos, and close or reopen. */
export function CustomerCase({ id }: { id: string }) {
  const caseQuery = useMyCase(id);
  const updates = useMyUpdates(id);
  const actions = useCustomerSupport(id);
  const busy = useRef(false);
  const keys = useRef<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [refused, setRefused] = useState(false);

  const begin = () => {
    // A synchronous guard: state updates are too slow to stop a rapid second click.
    if (busy.current) return false;
    busy.current = true;
    setFailure(null);
    setRefused(false);
    setProblem(null);
    return true;
  };
  const handlers = (after?: () => void) => ({
    onSuccess: () => {
      busy.current = false;
      after?.();
    },
    onError: (error: ApiError) => {
      busy.current = false;
      if (error.status === 409 || error.status === 404) setRefused(true);
      else if (error.status === 422) setProblem(text.errors.photo);
      else setFailure(error);
    },
  });

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <Link href="/my/support" className="inline-flex min-h-11 items-center text-sm underline underline-offset-2">
        {text.back}
      </Link>
      <QueryState query={caseQuery}>
        {(item) => (
          <>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">{item.symptom.slice(0, 80)}</h1>
            <p className="text-sm font-medium" data-status>
              {statusLabel(item.status)}
            </p>
            {item.safety_notice ? (
              <p role="alert" className="rounded-lg border-2 border-destructive p-3 text-sm font-medium" data-safety-notice>
                {item.safety_notice}
              </p>
            ) : null}
            {item.equipment ? <p className="text-sm">{format(text.equipment, { name: `${item.equipment.brand} ${item.equipment.model}` })}</p> : null}
            {item.observed_code ? <p className="text-sm">{item.observed_code}</p> : null}
            {refused ? <p role="alert" className="text-sm font-medium" data-refused>{text.refused}</p> : null}
            {failure ? <ApiErrorMessage error={failure} /> : null}

            <section aria-labelledby="updates-title" className="space-y-2">
              <h2 id="updates-title" className="font-heading text-xl font-semibold tracking-tight">
                {text.updatesTitle}
              </h2>
              <QueryState query={updates}>{(list) => <UpdatesList updates={list} companySide={false} />}</QueryState>
              {item.status !== "closed" ? (
                <form
                  noValidate
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (message.trim() === "") {
                      setProblem(text.errors.message);
                      return;
                    }
                    if (!begin()) return;
                    const key = (keys.current[message] ??= newKey());
                    actions.message.mutate({ body: message.trim(), key }, handlers(() => setMessage("")));
                  }}
                >
                  <label htmlFor="message" className="block text-sm font-medium">
                    {text.messageLabel}
                  </label>
                  <textarea id="message" rows={3} value={message} maxLength={2000} onChange={(event) => setMessage(event.target.value)} aria-invalid={Boolean(problem)} className="w-full rounded-lg border bg-transparent p-2 text-sm" />
                  {problem ? <p role="alert" className="text-sm font-medium text-destructive" data-error="message">{problem}</p> : null}
                  <Button type="submit" variant="outline" aria-disabled={actions.message.isPending} data-action="send-message">
                    {text.send}
                  </Button>
                </form>
              ) : null}
            </section>

            <section aria-labelledby="photos-title" className="space-y-2">
              <h2 id="photos-title" className="font-heading text-xl font-semibold tracking-tight">
                {text.photosTitle}
              </h2>
              <p className="text-sm text-muted-foreground">{text.photosHelp}</p>
              <PhotoList photos={item.attachments} fetchPhoto={customerPhoto(id)} label={text.photoDownload} none={text.noPhotos} />
              {item.status !== "resolved" && item.status !== "closed" ? (
                <>
                  <label htmlFor="photo" className="block text-sm font-medium">
                    {text.photoLabel}
                  </label>
                  <input
                    id="photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={actions.upload.isPending}
                    className="block min-h-11 w-full min-w-0 text-sm"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      const found = evidenceProblem(file);
                      setProblem(found);
                      if (found || !begin()) return;
                      actions.upload.mutate(file, handlers());
                    }}
                  />
                </>
              ) : null}
            </section>

            <div className="flex flex-wrap items-start gap-3">
              {customerMoves(item.status).map((move) => (
                <ConfirmAction
                  key={move.to}
                  id={`move-${move.to}`}
                  variant={move.to === "open" ? "default" : "outline"}
                  label={(messages.support.moves as Record<string, string>)[move.to] ?? move.to}
                  title={(messages.support.moves as Record<string, string>)[move.to] ?? move.to}
                  body={text.closeNote}
                  yes={(messages.support.moves as Record<string, string>)[move.to] ?? move.to}
                  keep={messages.support.company.back}
                  disabled={actions.status.isPending}
                  onConfirm={() => {
                    if (!begin()) return;
                    const key = (keys.current[`status-${move.to}-${item.status}`] ??= newKey());
                    actions.status.mutate({ to: move.to as "open" | "closed", body: reason, key }, handlers());
                  }}
                />
              ))}
            </div>
            {customerMoves(item.status).length > 0 ? (
              <div className="space-y-1">
                <label htmlFor="reason" className="block text-sm font-medium">
                  {text.closeNote}
                </label>
                <input id="reason" value={reason} maxLength={2000} onChange={(event) => setReason(event.target.value)} className="h-11 w-full rounded-lg border bg-transparent px-3 text-sm" />
              </div>
            ) : null}
          </>
        )}
      </QueryState>
    </div>
  );
}
