"use client";

import { BackLink } from "@/components/ui/back-link";
import { CircleAlert, CircleCheck, OctagonAlert, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { PhotoList } from "@/components/support/photo-list";
import { UpdatesList } from "@/components/support/updates-list";
import { QueryState } from "@/components/query-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { ApiError } from "@/lib/api/errors";
import { formatLongDate } from "@/lib/catalogue/detail";
import { evidenceProblem } from "@/lib/installations/evidence";
import { cn } from "@/lib/utils";
import { caseTone, customerMoves, newKey, statusLabel } from "@/lib/support/support";
import { customerPhoto, useCustomerSupport, useMyCase, useMyCases, useMyInstallations, useMyUpdates, useOpenCase } from "@/lib/support/hooks";
import { format, messages } from "@/messages";

const text = messages.support.customer;
const safety = messages.support.safety;

/** The safety message, first on every support screen: a red card, never a footnote. */
export function SafetyBox() {
  return (
    <section aria-labelledby="safety-title" className="flex flex-col gap-3 rounded-card border-2 border-danger bg-danger-tint p-5 sm:p-6" data-safety>
      <OctagonAlert aria-hidden className="size-7 text-danger" />
      <h2 id="safety-title" className="type-heading text-ink">
        {safety.title}
      </h2>
      <p className="type-body text-ink">{safety.body}</p>
    </section>
  );
}

/** One support request in the list: its status as a chip, its words, a warning when it was reported as unsafe, and the way in. */
export function CaseCard({ item, href, unsafeLabel }: { item: { id: string; status: string; symptom: string; unsafe_now: boolean }; href?: string; unsafeLabel?: string }) {
  return (
    <article className={cn("relative flex flex-col gap-2 rounded-card p-5 text-sm", item.unsafe_now ? "border-2 border-danger bg-danger-tint" : "border border-line bg-surface shadow-e1")} data-case={item.status} data-unsafe={item.unsafe_now}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={caseTone(item.status)} data-case-status>
          {statusLabel(item.status)}
        </Badge>
        {item.unsafe_now ? (
          <Badge variant="danger" icon={OctagonAlert} data-unsafe-chip>
            {unsafeLabel ?? safety.unsafeBox}
          </Badge>
        ) : null}
      </div>
      <h3 className="type-subheading text-ink">
        <Link href={href ?? `/my/support/${item.id}`} className="inline-flex min-h-11 items-center rounded-field outline-none after:absolute after:inset-0 after:rounded-card hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-orange-text">
          {format(text.open, { symptom: item.symptom.slice(0, 80) })}
        </Link>
      </h3>
    </article>
  );
}

/** The "this may be dangerous right now" box and, once ticked, the danger warning that says what to do. */
export function UnsafeField({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <>
      <div className="space-y-2 rounded-card border-2 border-danger/60 bg-paper p-4 has-[:checked]:border-danger has-[:checked]:bg-danger-tint">
        <label className="flex min-h-11 items-center gap-3 font-medium text-ink">
          <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-describedby="unsafe-help" className="field-check size-6 shrink-0" />
          <span>{safety.unsafeBox}</span>
        </label>
        <p id="unsafe-help" className="type-small text-ink-2">
          {safety.unsafeHelp}
        </p>
      </div>
      {checked ? (
        <Alert variant="hazard" role="alert" data-unsafe-warning>
          <OctagonAlert aria-hidden />
          <AlertDescription className="font-medium text-ink">{safety.body}</AlertDescription>
        </Alert>
      ) : null}
    </>
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
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      <SafetyBox />
      <Link href="/troubleshooting" className={cn(buttonVariants({ variant: "secondary" }), "w-fit")}>
        {text.troubleshoot}
      </Link>
      {sent ? (
        <Alert variant="success" role="status" data-sent>
          <CircleCheck aria-hidden />
          <AlertDescription className="space-y-1 text-ink">
            <p className="font-medium">{text.opened}</p>
            {sent.unsafe ? <p>{safety.body}</p> : null}
            <Link href={`/my/support/${sent.id}`} className="inline-flex min-h-11 items-center font-medium text-orange-text underline underline-offset-2">
              {text.back}
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}
      <QueryState query={cases} isEmpty={(items) => items.length === 0} empty={<p className="type-body rounded-card border border-line bg-surface p-4 text-ink-2" data-none>{text.none}</p>}>
        {(items) => (
          <ul className="grid gap-4 sm:grid-cols-2" data-cases>
            {items.map((item) => (
              <li key={item.id}>
                <CaseCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      <section aria-labelledby="new-title" className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6">
        <h2 id="new-title" className="type-heading text-ink">
          {text.newTitle}
        </h2>
        {installations.data && installations.data.items.length === 0 ? (
          <p className="type-body text-ink" data-no-installations>
            {text.noInstallations}
          </p>
        ) : (
          <form
            noValidate
            className="space-y-5 text-sm"
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
                <label htmlFor="installation" className="block font-medium text-ink">
                  {text.installation}
                </label>
                <select id="installation" value={installation} onChange={(event) => setInstallation(event.target.value)} aria-invalid={Boolean(errors.installation)} className="h-11 w-full field-control field-select px-3">
                  <option value="">{text.installation}</option>
                  {installations.data.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {format(text.installationLine, { date: formatLongDate(item.created_at) ?? item.created_at })}
                    </option>
                  ))}
                </select>
                {errors.installation ? <p className="flex items-center gap-1.5 font-medium text-danger" data-error="installation"><CircleAlert aria-hidden className="size-4 shrink-0" />{errors.installation}</p> : null}
              </div>
            ) : null}
            <div className="space-y-1">
              <label htmlFor="symptom" className="block font-medium text-ink">
                {text.symptom}
              </label>
              <textarea id="symptom" rows={4} value={symptom} maxLength={2000} onChange={(event) => setSymptom(event.target.value)} aria-invalid={Boolean(errors.symptom)} aria-describedby={`symptom-help${errors.symptom ? " symptom-error" : ""}`} className="w-full field-control p-3" />
              <p id="symptom-help" className="text-ink-2">
                {text.symptomHelp}
              </p>
              {errors.symptom ? (
                <p id="symptom-error" className="flex items-center gap-1.5 font-medium text-danger" data-error="symptom">
                  <CircleAlert aria-hidden className="size-4 shrink-0" />
                  {errors.symptom}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <label htmlFor="code" className="block font-medium text-ink">
                {text.code}
              </label>
              <input id="code" value={code} maxLength={64} onChange={(event) => setCode(event.target.value)} aria-describedby="code-help" className="h-11 w-full field-control px-3" />
              <p id="code-help" className="text-ink-2">
                {text.codeHelp}
              </p>
            </div>
            <UnsafeField checked={unsafe} onChange={setUnsafe} />
            <Button type="submit" size="lg" aria-disabled={open.isPending} data-action="report">
              {open.isPending ? text.sending : text.submit}
            </Button>
            {failure ? (failure.status === 409 ? <Alert variant="warning" role="alert" data-limit><TriangleAlert aria-hidden /><AlertDescription>{text.limit}</AlertDescription></Alert> : <ApiErrorMessage error={failure} />) : null}
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
      <BackLink href="/my/support">{text.back}</BackLink>
      <QueryState query={caseQuery}>
        {(item) => (
          <>
            <header className="space-y-3 rounded-panel border border-line bg-surface p-6 shadow-e1" data-case-header>
              <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{text.eyebrow}</p>
              <h1 className="type-display-m text-ink">{item.symptom.slice(0, 80)}</h1>
              <p data-status>
                <Badge variant={caseTone(item.status)}>{statusLabel(item.status)}</Badge>
              </p>
              {item.safety_notice ? (
                <Alert variant="hazard" role="alert" data-safety-notice>
                  <OctagonAlert aria-hidden />
                  <AlertDescription className="font-medium text-ink">{item.safety_notice}</AlertDescription>
                </Alert>
              ) : null}
              {item.equipment ? <p className="type-body text-ink">{format(text.equipment, { name: `${item.equipment.brand} ${item.equipment.model}` })}</p> : null}
              {item.observed_code ? <p className="type-figure text-ink-2">{item.observed_code}</p> : null}
            </header>
            {refused ? (
              <Alert variant="warning" role="alert" data-refused>
                <TriangleAlert aria-hidden />
                <AlertDescription>{text.refused}</AlertDescription>
              </Alert>
            ) : null}
            {failure ? <ApiErrorMessage error={failure} /> : null}

            <section aria-labelledby="updates-title" className="space-y-4">
              <h2 id="updates-title" className="type-heading text-ink">
                {text.updatesTitle}
              </h2>
              <QueryState query={updates}>{(list) => <UpdatesList updates={list} companySide={false} />}</QueryState>
              {item.status !== "closed" ? (
                <form
                  noValidate
                  className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-e1"
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
                  <label htmlFor="message" className="block text-sm font-medium text-ink">
                    {text.messageLabel}
                  </label>
                  <textarea id="message" rows={3} value={message} maxLength={2000} onChange={(event) => setMessage(event.target.value)} aria-invalid={Boolean(problem)} className="w-full field-control p-3 text-sm" />
                  {problem ? <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-danger" data-error="message"><CircleAlert aria-hidden className="size-4 shrink-0" />{problem}</p> : null}
                  <Button type="submit" variant="outline" aria-disabled={actions.message.isPending} data-action="send-message">
                    {text.send}
                  </Button>
                </form>
              ) : null}
            </section>

            <section aria-labelledby="photos-title" className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6">
              <h2 id="photos-title" className="type-heading text-ink">
                {text.photosTitle}
              </h2>
              <p className="type-small text-ink-2">{text.photosHelp}</p>
              <PhotoList photos={item.attachments} fetchPhoto={customerPhoto(id)} label={text.photoDownload} none={text.noPhotos} />
              {item.status !== "resolved" && item.status !== "closed" ? (
                <>
                  <label htmlFor="photo" className="block text-sm font-medium text-ink">
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
              <div className="space-y-2">
                <label htmlFor="reason" className="block text-sm font-medium text-ink">
                  {text.closeNote}
                </label>
                <input id="reason" value={reason} maxLength={2000} onChange={(event) => setReason(event.target.value)} className="h-11 w-full field-control px-3 text-sm" />
              </div>
            ) : null}
          </>
        )}
      </QueryState>
    </div>
  );
}
