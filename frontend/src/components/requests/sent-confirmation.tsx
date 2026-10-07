"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { StatusNote } from "@/components/ui/status-note";
import { type SentRequest, useRequestDraft } from "@/lib/requests/draft-store";
import { format, messages } from "@/messages";

const text = messages.requestPrep.sent;
const statusNames: Record<string, string> = text.statuses;

/** What was sent and to whom, shown after the server accepted the request. */
export function SentConfirmation({ sent }: { sent: SentRequest }) {
  const reset = useRequestDraft((state) => state.reset);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section aria-labelledby="sent-title" className="space-y-4 rounded-card border border-success bg-success-tint p-5 sm:p-6" data-sent>
      <h2
        id="sent-title"
        ref={heading}
        tabIndex={-1}
        className="type-heading flex items-center gap-2 text-ink outline-none"
      >
        <CircleCheck aria-hidden className="size-6 shrink-0 text-success" />
        {text.title}
      </h2>
      {sent.replayed ? (
        <StatusNote tone="info" data-replayed>
          {text.replayed}
        </StatusNote>
      ) : null}
      <p className="type-body text-ink">{text.intro}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm" data-sent-companies>
        {sent.companies.map((company) => (
          <li key={company.id}>
            {format(text.companyStatus, { name: company.name, status: statusNames[company.status] ?? company.status })}
          </li>
        ))}
      </ul>
      <p className="type-small text-ink-2">{format(text.reference, { id: sent.id })}</p>
      <p className="type-small text-ink-2">{text.next}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/my/requests/${sent.id}`}>{text.follow}</Link>
        </Button>
        <Button type="button" variant="outline" onClick={reset}>
          {text.another}
        </Button>
        <Button asChild variant="outline">
          <Link href="/companies">{text.browse}</Link>
        </Button>
      </div>
    </section>
  );
}
