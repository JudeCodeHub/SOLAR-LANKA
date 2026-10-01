"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api/errors";
import { useCurrentQuotation, useStartDraft } from "@/lib/quotation/hooks";
import { format, messages } from "@/messages";

const text = messages.company.quotation.section;
const statusNames: Record<string, string> = text.statuses;

/** The enquiry's quotation: start a draft, open it, or see where it stands. */
export function QuotationSection({
  companyId,
  deliveryId,
  active,
  onRefused,
}: {
  companyId: string;
  deliveryId: string;
  active: boolean;
  /** Called when the server refuses because the enquiry moved on, so the page can explain from fresh state. */
  onRefused: () => void;
}) {
  const router = useRouter();
  const query = useCurrentQuotation(companyId, deliveryId);
  const start = useStartDraft(companyId, deliveryId);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<ApiError | null>(null);
  // Synchronous guard: React state is too slow to stop several clicks in the same moment.
  const inFlight = useRef(false);
  const href = `/company/inbox/${deliveryId}/quotation?company=${companyId}`;

  const begin = () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setNotice(null);
    setProblem(null);
    start.mutate(undefined, {
      onSuccess: () => router.push(href),
      onSettled: () => {
        inFlight.current = false;
      },
      onError: (error) => {
        if (error.status === 409) {
          // Either a draft already exists or the enquiry is no longer active: read both again.
          onRefused();
          void query.refetch().then((fresh) => setNotice(fresh.data ? text.alreadyStarted : null));
        } else {
          setProblem(error);
        }
      },
    });
  };

  return (
    <section aria-labelledby="quotation-title" className="space-y-3 rounded-lg border p-4" data-quotation-section>
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="quotation-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.title}
        </h2>
        <span className="rounded-full border px-2 py-0.5 text-xs" data-badge="draft">
          {text.badgeDraft}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{text.intro}</p>
      {notice ? (
        <p role="status" className="text-sm font-medium" data-notice>
          {notice}
        </p>
      ) : null}
      {problem ? <ApiErrorMessage error={problem} /> : null}
      <QueryState query={query}>
        {(current) =>
          current ? (
            <div className="space-y-2">
              <p className="text-sm" data-quotation-status={current.status}>
                {format(text.status, { status: statusNames[current.status] ?? current.status })}
              </p>
              <Button asChild variant="outline">
                <Link href={href}>{text.open}</Link>
              </Button>
            </div>
          ) : active ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{text.none}</p>
              <Button type="button" variant="outline" onClick={begin} aria-disabled={start.isPending} data-start-draft>
                {start.isPending ? text.starting : text.start}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{text.inactive}</p>
          )
        }
      </QueryState>
    </section>
  );
}
