"use client";

import { BackLink } from "@/components/ui/back-link";
import { CircleAlert, OctagonAlert, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { CaseCard } from "@/components/support/customer-support";
import { PageHeader } from "@/components/ui/page-header";
import { PhotoList } from "@/components/support/photo-list";
import { UpdatesList } from "@/components/support/updates-list";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api/errors";
import { technicianPhoto, useAssignedCase, useAssignedCases, useTechnicianSupport } from "@/lib/support/hooks";
import { caseTone, dangerFirst, newKey, statusLabel } from "@/lib/support/support";
import { format, messages } from "@/messages";

const text = messages.support.technician;

/** The support requests a technician is assigned to: the problem, never the customer. */
export function TechnicianCases() {
  const query = useAssignedCases();
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      <QueryState query={query} isEmpty={(items) => items.length === 0} empty={<EmptyState title={text.none} />}>
        {(items) => (
          <ul className="grid gap-4 sm:grid-cols-2" data-cases>
            {dangerFirst(items).map((item) => (
              <li key={item.id}>
                <CaseCard item={item} href={`/technician/support/${item.id}`} unsafeLabel={messages.support.company.unsafeFirst} />
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </div>
  );
}

export function TechnicianCase({ id }: { id: string }) {
  const query = useAssignedCase(id);
  const post = useTechnicianSupport(id);
  const busy = useRef(false);
  const keys = useRef<Record<string, string>>({});
  const [body, setBody] = useState("");
  const [shared, setShared] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [refused, setRefused] = useState(false);
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <BackLink href="/technician/support">{text.back}</BackLink>
      <QueryState query={query}>
        {(item) => (
          <>
            {item.unsafe_now ? (
              <Alert variant="hazard" role="alert" data-unsafe>
                <OctagonAlert aria-hidden />
                <AlertDescription className="font-semibold text-ink">{messages.support.company.unsafeFirst}</AlertDescription>
              </Alert>
            ) : null}
            <header className="space-y-3 rounded-panel border border-line bg-surface p-5 shadow-e1 sm:p-6" data-case-header>
              <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{text.detailEyebrow}</p>
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
            {failure ? <ApiErrorMessage error={failure} /> : null}
            <section aria-labelledby="photos-title" className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6">
              <h2 id="photos-title" className="type-heading text-ink">
                {text.photos}
              </h2>
              <PhotoList photos={item.attachments} fetchPhoto={technicianPhoto(id)} label={text.download} none={text.noPhotos} />
            </section>
            <section aria-labelledby="history-title" className="space-y-4">
              <h2 id="history-title" className="type-heading text-ink">
                {text.history}
              </h2>
              <UpdatesList updates={item.updates} companySide />
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
                    setProblem(null);
                    if (busy.current) return;
                    busy.current = true;
                    setFailure(null);
                    setRefused(false);
                    post.mutate(
                      { body: body.trim(), shared, key: (keys.current[`${body}|${shared}`] ??= newKey()) },
                      {
                        onSuccess: () => {
                          busy.current = false;
                          setBody("");
                        },
                        onError: (error) => {
                          busy.current = false;
                          if (error.status === 409 || error.status === 404) setRefused(true);
                          else setFailure(error);
                        },
                      },
                    );
                  }}
                >
                  <label htmlFor="update" className="block font-medium text-ink">
                    {text.updateLabel}
                  </label>
                  <textarea id="update" rows={3} value={body} maxLength={2000} onChange={(event) => setBody(event.target.value)} aria-invalid={Boolean(problem)} className="w-full field-control p-3 text-base" />
                  {problem ? <p role="alert" className="flex items-center gap-1.5 font-medium text-danger" data-error="update"><CircleAlert aria-hidden className="size-4 shrink-0" />{problem}</p> : null}
                  <label className="flex min-h-11 items-center gap-3 text-ink">
                    <input type="checkbox" checked={shared} onChange={(event) => setShared(event.target.checked)} aria-describedby="shared-help" className="field-check size-6 shrink-0" />
                    <span>{text.shared}</span>
                  </label>
                  <p id="shared-help" className="text-ink-2">
                    {text.sharedHelp}
                  </p>
                  <Button type="submit" aria-disabled={post.isPending} data-action="add-update">
                    {text.send}
                  </Button>
                </form>
              ) : null}
            </section>
          </>
        )}
      </QueryState>
    </div>
  );
}
