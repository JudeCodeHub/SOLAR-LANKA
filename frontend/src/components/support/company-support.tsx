"use client";

import { Dropdown } from "@/components/ui/dropdown";
import { BackLink } from "@/components/ui/back-link";
import { CircleAlert, OctagonAlert, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { StaffGate } from "@/components/company/staff-gate";
import { CaseCard } from "@/components/support/customer-support";
import { PhotoList } from "@/components/support/photo-list";
import { UpdatesList } from "@/components/support/updates-list";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { ApiError } from "@/lib/api/errors";
import { companyPhoto, useCaseAssignments, useCompanyCase, useCompanyCases, useCompanySupport, useCompanyUpdates } from "@/lib/support/hooks";
import { caseTone, newKey, shortId, staffMoves, statusLabel } from "@/lib/support/support";
import { useTechnicians } from "@/lib/visits/hooks";
import { format, messages } from "@/messages";

const text = messages.support.company;
const moves: Record<string, string> = messages.support.moves;

/** The company's support requests, dangerous ones first. */
export function CompanySupport() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      <StaffGate basePath="/company/support">{(company) => <List companyId={company.company_id} />}</StaffGate>
    </div>
  );
}

function List({ companyId }: { companyId: string }) {
  const query = useCompanyCases(companyId);
  return (
    <QueryState query={query} isEmpty={(items) => items.length === 0} empty={<EmptyState title={text.none} />}>
      {(items) => (
        <ul className="grid gap-4 sm:grid-cols-2" data-cases>
          {items.map((item) => (
            <li key={item.id}>
              <CaseCard item={item} href={`/company/support/${item.id}?company=${companyId}`} unsafeLabel={text.unsafeFirst} />
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
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
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
      <BackLink href={`/company/support?company=${companyId}`}>{text.back}</BackLink>
      <QueryState query={caseQuery}>
        {(item) => (
          <>
            {item.unsafe_now ? (
              <Alert variant="hazard" role="alert" data-unsafe>
                <OctagonAlert aria-hidden />
                <AlertDescription className="font-semibold text-ink">{text.unsafeFirst}</AlertDescription>
              </Alert>
            ) : null}
            <header className="space-y-3 rounded-panel border border-line bg-surface p-6 shadow-e1" data-case-header>
              <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{text.eyebrow}</p>
              <h1 className="type-display-m text-ink">{item.symptom.slice(0, 80)}</h1>
              <p data-status>
                <Badge variant={caseTone(item.status)}>{statusLabel(item.status)}</Badge>
              </p>
              <p className="type-body whitespace-pre-wrap text-ink">{item.symptom}</p>
              {item.equipment ? <p className="type-body text-ink">{format(messages.support.customer.equipment, { name: `${item.equipment.brand} ${item.equipment.model}` })}</p> : null}
              {item.observed_code ? <p className="type-figure text-ink-2">{item.observed_code}</p> : null}
            </header>
            {refused ? (
              <Alert variant="warning" role="alert" data-refused>
                <TriangleAlert aria-hidden />
                <AlertDescription>{text.refused}</AlertDescription>
              </Alert>
            ) : null}
            {problem ? (
              <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-danger" data-error="problem">
                <CircleAlert aria-hidden className="size-4 shrink-0" />
                {problem}
              </p>
            ) : null}
            {failure ? <ApiErrorMessage error={failure} /> : null}

            <section aria-labelledby="assign-title" className="space-y-3 rounded-card border border-line bg-surface p-5 text-sm shadow-e1 sm:p-6">
              <h2 id="assign-title" className="type-heading text-ink">
                {text.assignTitle}
              </h2>
              {(assignments.data ?? []).length === 0 ? <p className="text-ink-2">{text.noneAssigned}</p> : (
                <ul className="space-y-2" data-assigned>
                  {(assignments.data ?? []).map((user) => (
                    <li key={user} className="flex flex-wrap items-center gap-3 text-ink">
                      <span>{format(text.assigned, { id: shortId(user) })}</span>
                      <Button type="button" variant="outline" data-action="unassign" onClick={() => begin() && actions.unassign.mutate(user, handlers())}>
                        {format(text.remove, { id: shortId(user) })}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {item.status !== "closed" ? (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="technician" className="block font-medium text-ink">
                      {text.assign}
                    </label>
                    <Dropdown id="technician" value={technician} onChange={(event) => setTechnician(event.target.value)} className="h-11 field-control px-3">
                      <option value="">{text.choose}</option>
                      {(technicians.data ?? []).map((t) => (
                        <option key={t.user_id} value={t.user_id}>
                          {format(messages.visits.staff.technicianLine, { id: shortId(t.user_id) })}
                        </option>
                      ))}
                    </Dropdown>
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
              {(technicians.data ?? []).length === 0 ? <p className="text-ink-2">{text.noTechnicians}</p> : null}
            </section>

            <section aria-labelledby="photos-title" className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6">
              <h2 id="photos-title" className="type-heading text-ink">
                {messages.support.technician.photos}
              </h2>
              <PhotoList photos={item.attachments} fetchPhoto={companyPhoto(companyId, id)} label={messages.support.technician.download} none={messages.support.technician.noPhotos} />
            </section>

            <section aria-labelledby="history-title" className="space-y-4">
              <h2 id="history-title" className="type-heading text-ink">
                {text.history}
              </h2>
              <QueryState query={updates}>{(list) => <UpdatesList updates={list} companySide />}</QueryState>
              {item.status !== "closed" ? (
                <form
                  noValidate
                  className="space-y-3 rounded-card border border-line bg-surface p-5 text-sm shadow-e1"
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
                  <label htmlFor="update" className="block font-medium text-ink">
                    {text.updateLabel}
                  </label>
                  <textarea id="update" rows={3} value={body} maxLength={2000} onChange={(event) => setBody(event.target.value)} className="w-full field-control p-3" />
                  <label className="flex min-h-11 items-center gap-3 text-ink">
                    <input type="checkbox" checked={shared} onChange={(event) => setShared(event.target.checked)} aria-describedby="shared-help" className="field-check size-6 shrink-0" />
                    <span>{text.shared}</span>
                  </label>
                  <p id="shared-help" className="text-ink-2">
                    {text.sharedHelp}
                  </p>
                  <Button type="submit" aria-disabled={actions.update.isPending} data-action="add-update">
                    {text.send}
                  </Button>
                </form>
              ) : (
                <p className="type-body text-ink">{text.closedNote}</p>
              )}
            </section>

            {staffMoves(item.status).length > 0 ? (
              <section aria-labelledby="moves-title" className="space-y-3 rounded-card border border-line bg-surface p-5 text-sm shadow-e1 sm:p-6">
                <h2 id="moves-title" className="type-heading text-ink">
                  {text.status}
                </h2>
                <label htmlFor="reason" className="block font-medium text-ink">
                  {text.closeReason}
                </label>
                <input id="reason" value={reason} maxLength={2000} onChange={(event) => setReason(event.target.value)} className="h-11 w-full field-control px-3" />
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
