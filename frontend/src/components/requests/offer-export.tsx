"use client";

import { ApiErrorMessage } from "@/components/api-error-message";
import { Button } from "@/components/ui/button";
import { useRevisionExport } from "@/lib/quotation/export-hooks";
import { messages } from "@/messages";

const text = messages.customerOffers.export;

/** Ask for a PDF of one revision, wait while it is prepared, then download it. */
export function OfferExport({ requestId, quotationId, revisionId, revisionNumber }: { requestId: string; quotationId: string; revisionId: string; revisionNumber: number }) {
  const exported = useRevisionExport(requestId, quotationId, revisionId, revisionNumber);
  const busy = exported.request.isPending || exported.download.isPending;
  const error = exported.request.error ?? exported.status.error ?? exported.download.error;
  return (
    <section aria-labelledby="export-title" className="space-y-2" data-export>
      <h2 id="export-title" className="font-heading text-xl font-semibold tracking-tight">
        {text.title}
      </h2>
      <p className="text-sm text-muted-foreground">{text.intro}</p>
      {!exported.started ? (
        <Button type="button" variant="outline" aria-disabled={busy} data-export-request onClick={() => !busy && exported.request.mutate()}>
          {text.request}
        </Button>
      ) : exported.ready ? (
        <div className="space-y-2">
          <p role="status" className="text-sm font-medium" data-export-ready>
            {text.ready}
          </p>
          <Button type="button" variant="outline" aria-disabled={busy} data-export-download onClick={() => !busy && exported.download.mutate()}>
            {exported.download.isPending ? text.downloading : text.download}
          </Button>
        </div>
      ) : (
        <p role="status" className="text-sm" data-export-pending>
          {text.preparing}
        </p>
      )}
      {error ? <ApiErrorMessage error={error} /> : null}
    </section>
  );
}
