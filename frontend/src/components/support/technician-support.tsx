"use client";

import { BackLink } from "@/components/ui/back-link";
import Link from "next/link";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { PhotoList } from "@/components/support/photo-list";
import { UpdatesList } from "@/components/support/updates-list";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api/errors";
import { technicianPhoto, useAssignedCase, useAssignedCases, useTechnicianSupport } from "@/lib/support/hooks";
import { newKey, statusLabel } from "@/lib/support/support";
import { format, messages } from "@/messages";

const text = messages.support.technician;

/** The support requests a technician is assigned to: the problem, never the customer. */
export function TechnicianCases() {
  const query = useAssignedCases();
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      <QueryState query={query} isEmpty={(items) => items.length === 0} empty={<EmptyState title={text.none} />}>
        {(items) => (
          <ul className="space-y-2" data-cases>
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border p-3 text-sm" data-unsafe={item.unsafe_now}>
                {item.unsafe_now ? <p className="font-semibold">{messages.support.company.unsafeFirst}</p> : null}
                <Link href={`/technician/support/${item.id}`} className="inline-flex min-h-11 items-center font-medium underline underline-offset-2">
                  {format(text.open, { symptom: item.symptom.slice(0, 80) })}
                </Link>
                <p className="text-muted-foreground">{statusLabel(item.status)}</p>
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
              <p role="alert" className="rounded-lg border-2 border-destructive p-3 text-sm font-semibold" data-unsafe>
                {messages.support.company.unsafeFirst}
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
            {failure ? <ApiErrorMessage error={failure} /> : null}
            <section aria-labelledby="photos-title" className="space-y-2">
              <h2 id="photos-title" className="font-heading text-xl font-semibold tracking-tight">
                {text.photos}
              </h2>
              <PhotoList photos={item.attachments} fetchPhoto={technicianPhoto(id)} label={text.download} none={text.noPhotos} />
            </section>
            <section aria-labelledby="history-title" className="space-y-2">
              <h2 id="history-title" className="font-heading text-xl font-semibold tracking-tight">
                {text.history}
              </h2>
              <UpdatesList updates={item.updates} companySide />
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
                  <label htmlFor="update" className="block font-medium">
                    {text.updateLabel}
                  </label>
                  <textarea id="update" rows={3} value={body} maxLength={2000} onChange={(event) => setBody(event.target.value)} aria-invalid={Boolean(problem)} className="w-full field-control p-2" />
                  {problem ? <p role="alert" className="font-medium text-destructive" data-error="update">{problem}</p> : null}
                  <label className="flex min-h-11 items-center gap-3">
                    <input type="checkbox" checked={shared} onChange={(event) => setShared(event.target.checked)} aria-describedby="shared-help" className="field-check size-6 shrink-0" />
                    <span>{text.shared}</span>
                  </label>
                  <p id="shared-help" className="text-muted-foreground">
                    {text.sharedHelp}
                  </p>
                  <Button type="submit" variant="outline" aria-disabled={post.isPending} data-action="add-update">
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
