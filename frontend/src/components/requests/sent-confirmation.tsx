"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
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
    <section aria-labelledby="sent-title" className="space-y-4" data-sent>
      <h2
        id="sent-title"
        ref={heading}
        tabIndex={-1}
        className="font-heading text-2xl font-semibold tracking-tight outline-none"
      >
        {text.title}
      </h2>
      {sent.replayed ? (
        <p role="status" className="text-sm font-medium" data-replayed>
          {text.replayed}
        </p>
      ) : null}
      <p className="text-sm">{text.intro}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm" data-sent-companies>
        {sent.companies.map((company) => (
          <li key={company.id}>
            {format(text.companyStatus, { name: company.name, status: statusNames[company.status] ?? company.status })}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">{format(text.reference, { id: sent.id })}</p>
      <p className="text-sm text-muted-foreground">{text.next}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={reset}>
          {text.another}
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/companies">{text.browse}</Link>
        </Button>
      </div>
    </section>
  );
}
