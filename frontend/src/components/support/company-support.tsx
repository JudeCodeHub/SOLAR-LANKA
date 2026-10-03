"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { StaffGate } from "@/components/company/staff-gate";
import { PhotoList } from "@/components/support/photo-list";
import { UpdatesList } from "@/components/support/updates-list";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api/errors";
import { companyPhoto, useCaseAssignments, useCompanyCase, useCompanyCases, useCompanySupport, useCompanyUpdates } from "@/lib/support/hooks";
import { newKey, shortId, staffMoves, statusLabel } from "@/lib/support/support";
import { useTechnicians } from "@/lib/visits/hooks";
import { format, messages } from "@/messages";

const text = messages.support.company;
const moves: Record<string, string> = messages.support.moves;

/** The company's support requests, dangerous ones first. */
export function CompanySupport() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      <StaffGate basePath="/company/support">{(company) => <List companyId={company.company_id} />}</StaffGate>
    </div>
  );
}

function List({ companyId }: { companyId: string }) {
  const query = useCompanyCases(companyId);
  return (
    <QueryState query={query} isEmpty={(items) => items.length === 0} empty={<EmptyState title={text.none} />}>
      {(items) => (
        <ul className="space-y-2" data-cases>
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border p-3 text-sm" data-case={item.status} data-unsafe={item.unsafe_now}>
              {item.unsafe_now ? <p className="font-semibold">{text.unsafeFirst}</p> : null}
              <Link href={`/company/support/${item.id}?company=${companyId}`} className="inline-flex min-h-11 items-center font-medium underline underline-offset-2">
                {format(text.open, { symptom: item.symptom.slice(0, 80) })}
              </Link>
              <p className="text-muted-foreground">{statusLabel(item.status)}</p>
            </li>
          ))}
        </ul>
      )}
    </QueryState>
  );
}

/** One case for the company: assign a technician, post updates, and move it through its statuses. */
export function CompanyCase({ id }: { id: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <StaffGate basePath={`/company/support/${id}`}>{(company) => <Case companyId={company.company_id} id={id} />}</StaffGate>
    </div>
  );
}

function Case({ companyId, id }: { companyId: string; id: string }) {
  const caseQuery = useCompanyCase(companyId, id);
  const updates = useCompanyUpdates(companyId, id);
  const assignments = useCaseAssignments(companyId, id);
  const technicians = useTechnicians(companyId);
  const actions = useCompanySupport(companyId, id);
  const busy = useRef(false);
  const keys = useRef<Record<string, string>>({});
  const [technician, setTechnician] = useState("");
  const [body, setBody] = useState("");
  const [shared, setShared] = useState(true);
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
      else setFailure(error);
    },
  });

  return (
    <>
      <Link href={`/company/support?company=${companyId}`} className="inline-flex min-h-11 items-center text-sm underline underline-offset-2">
        {text.back}
      </Link>
      <QueryState query={caseQuery}>
        {(item) => (
          <>
            {item.unsafe_now ? (
              <p role="alert" className="rounded-lg border-2 border-destructive p-3 text-sm font-semibold" data-unsafe>
                {text.unsafeFirst}
              </p>
            ) : null}
            <h1 className="font-heading text-3xl font-semibold tracking-tight">{item.symptom.slice(0, 80)}</h1>
            <p className="text-sm font-medium" data-status>
              {statusLabel(item.status)}
            </p>
            <p className="whitespace-pre-wrap text-sm">{item.symptom}</p>
            {item.equipment ? <p className="text-sm">{format(messages.support.customer.equipment, { name: `${item.equipment.brand} ${item.equipment.model}` })}</p> : null}
            {item.observed_code ? <p className="text-sm">{item.observed_code}</p> : null}
            {refused ? <p role="alert" className="text-sm font-medium" data-refused>{text.refused}</p> : null}
            {problem ? <p role="alert" className="text-sm font-medium text-destructive" data-error="problem">{problem}</p> : null}
            {failure ? <ApiErrorMessage error={failure} /> : null}

            <section aria-labelledby="assign-title" className="space-y-2 text-sm">
              <h2 id="assign-title" className="font-heading text-xl font-semibold tracking-tight">
                {text.assignTitle}
              </h2>
              {(assignments.data ?? []).length === 0 ? <p className="text-muted-foreground">{text.noneAssigned}</p> : (
                <ul className="space-y-1" data-assigned>
                  {(assignments.data ?? []).map((user) => (
                    <li key={user} className="flex flex-wrap items-center gap-2">
                      <span>{format(text.assigned, { id: shortId(user) })}</span>
                      <Button type="button" variant="outline" size="sm" data-action="unassign" onClick={() => begin() && actions.unassign.mutate(user, handlers())}>
                        {format(text.remove, { id: shortId(user) })}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {item.status !== "closed" ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <label htmlFor="technician" className="block font-medium">
                      {text.assign}
                    </label>
                    <select id="technician" value={technician} onChange={(event) => setTechnician(event.target.value)} className="h-11 rounded-lg border bg-transparent px-2">
                      <option value="">{text.choose}</option>
                      {(technicians.data ?? []).map((t) => (
                        <option key={t.user_id} value={t.user_id}>
                          {format(messages.visits.staff.technicianLine, { id: shortId(t.user_id) })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    data-action="assign"
                    onClick={() => {
                      if (technician === "") {
                        setProblem(text.choose);
                        return;
                      }
                      if (!begin()) return;
                      actions.assign.mutate({ user: technician, key: (keys.current[`assign-${technician}`] ??= newKey()) }, handlers(() => setTechnician("")));
                    }}
                  >
                    {text.assign}
                  </Button>
                </div>
              ) : null}
              {(technicians.data ?? []).length === 0 ? <p className="text-muted-foreground">{text.noTechnicians}</p> : null}
            </section>

            <section aria-labelledby="photos-title" className="space-y-2">
              <h2 id="photos-title" className="font-heading text-xl font-semibold tracking-tight">
                {messages.support.technician.photos}
              </h2>
              <PhotoList photos={item.attachments} fetchPhoto={companyPhoto(companyId, id)} label={messages.support.technician.download} none={messages.support.technician.noPhotos} />
            </section>

            <section aria-labelledby="history-title" className="space-y-2">
              <h2 id="history-title" className="font-heading text-xl font-semibold tracking-tight">
                {text.history}
              </h2>
              <QueryState query={updates}>{(list) => <UpdatesList updates={list} companySide />}</QueryState>
              {item.status !== "closed" ? (
                <form
                  noValidate
                  className="space-y-2 text-sm"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (body.trim() === "") {
                      setProblem(messages.support.customer.errors.message);
                      return;
                    }
                    if (!begin()) return;
                    actions.update.mutate({ body: body.trim(), shared, key: (keys.current[`${body}|${shared}`] ??= newKey()) }, handlers(() => setBody("")));
                  }}
                >
                  <label htmlFor="update" className="block font-medium">
                    {text.updateLabel}
                  </label>
                  <textarea id="update" rows={3} value={body} maxLength={2000} onChange={(event) => setBody(event.target.value)} className="w-full rounded-lg border bg-transparent p-2" />
                  <label className="flex min-h-11 items-center gap-3">
                    <input type="checkbox" checked={shared} onChange={(event) => setShared(event.target.checked)} aria-describedby="shared-help" className="size-6 shrink-0" />
                    <span>{text.shared}</span>
                  </label>
                  <p id="shared-help" className="text-muted-foreground">
                    {text.sharedHelp}
                  </p>
                  <Button type="submit" variant="outline" aria-disabled={actions.update.isPending} data-action="add-update">
                    {text.send}
                  </Button>
                </form>
              ) : (
                <p className="text-sm">{text.closedNote}</p>
              )}
            </section>

            {staffMoves(item.status).length > 0 ? (
              <section aria-labelledby="moves-title" className="space-y-2 text-sm">
                <h2 id="moves-title" className="font-heading text-xl font-semibold tracking-tight">
                  {text.status}
                </h2>
                <label htmlFor="reason" className="block font-medium">
                  {text.closeReason}
                </label>
                <input id="reason" value={reason} maxLength={2000} onChange={(event) => setReason(event.target.value)} className="h-11 w-full rounded-lg border bg-transparent px-3" />
                <div className="flex flex-wrap items-start gap-3">
                  {staffMoves(item.status).map((move) => (
                    <ConfirmAction
                      key={move.to}
                      id={`move-${move.to}`}
                      variant={move.to === "closed" ? "outline" : "default"}
                      label={moves[move.to] ?? move.to}
                      title={moves[move.to] ?? move.to}
                      body={move.needsReason ? text.reasonNeeded : text.closeReason}
                      yes={moves[move.to] ?? move.to}
                      keep={text.back}
                      disabled={actions.status.isPending}
                      onBeforeOpen={() => {
                        if (move.needsReason && reason.trim() === "") {
                          setProblem(text.reasonNeeded);
                          return false;
                        }
                        setProblem(null);
                        return true;
                      }}
                      onConfirm={() => {
                        if (!begin()) return;
                        actions.status.mutate({ to: move.to, body: reason, key: (keys.current[`s-${move.to}-${item.status}`] ??= newKey()) }, handlers(() => setReason("")));
                      }}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </QueryState>
    </>
  );
}
