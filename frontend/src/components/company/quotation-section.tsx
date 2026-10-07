"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { QueryState } from "@/components/query-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
    <section aria-labelledby="quotation-title" className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" data-quotation-section>
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="quotation-title" className="type-heading text-ink">
          {text.title}
        </h2>
        <Badge variant="neutral" data-badge="draft">
          {text.badgeDraft}
        </Badge>
      </div>
      <p className="type-small text-ink-2">{text.intro}</p>
      {notice ? (
        <Alert variant="info" role="status" data-notice>
          <Info aria-hidden />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      {problem ? <ApiErrorMessage error={problem} /> : null}
      <QueryState query={query}>
        {(current) =>
          current ? (
            <div className="space-y-2">
              <p className="type-body font-medium text-ink" data-quotation-status={current.status}>
                {format(text.status, { status: statusNames[current.status] ?? current.status })}
              </p>
              <Button asChild>
                <Link href={href}>{text.open}</Link>
              </Button>
            </div>
          ) : active ? (
            <div className="space-y-2">
              <p className="type-body text-ink-2">{text.none}</p>
              <Button type="button" variant="outline" onClick={begin} aria-disabled={start.isPending} data-start-draft>
                {start.isPending ? text.starting : text.start}
              </Button>
            </div>
          ) : (
            <p className="type-body text-ink-2">{text.inactive}</p>
          )
        }
      </QueryState>
    </section>
  );
}
