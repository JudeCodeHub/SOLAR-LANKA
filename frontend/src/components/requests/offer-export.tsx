"use client";

import { CircleCheck, Download, FileText } from "lucide-react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { Button } from "@/components/ui/button";
import { DialLoader } from "@/components/ui/dial-loader";
import { IconCircle } from "@/components/ui/icon";
import type { ApiError } from "@/lib/api/errors";
import { useRevisionExport } from "@/lib/quotation/export-hooks";
import { messages } from "@/messages";

const text = messages.customerOffers.export;

/** Ask for a PDF of one revision, wait while it is prepared, then download it. */
export function OfferExport({ requestId, quotationId, revisionId, revisionNumber }: { requestId: string; quotationId: string; revisionId: string; revisionNumber: number }) {
  const exported = useRevisionExport(requestId, quotationId, revisionId, revisionNumber);
  const busy = exported.request.isPending || exported.download.isPending;
  const error = exported.request.error ?? exported.status.error ?? exported.download.error;
  return (
    <ExportPanel
      started={exported.started}
      ready={exported.ready}
      busy={busy}
      downloading={exported.download.isPending}
      error={error}
      onRequest={() => exported.request.mutate()}
      onDownload={() => exported.download.mutate()}
    />
  );
}

/** The four looks of the section: not asked for yet, being prepared, ready to download, and failed (the error sits under whichever look the section was in). */
export function ExportPanel({
  started,
  ready,
  busy,
  downloading,
  error,
  onRequest,
  onDownload,
}: {
  started: boolean;
  ready: boolean;
  busy: boolean;
  downloading: boolean;
  error: ApiError | null | undefined;
  onRequest: () => void;
  onDownload: () => void;
}) {
  const state = !started ? "idle" : ready ? "ready" : "preparing";
  return (
    <section aria-labelledby="export-title" className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" data-export data-export-state={error ? "failed" : state}>
      <div className="flex items-center gap-3">
        <IconCircle icon={state === "ready" ? CircleCheck : FileText} tone={state === "ready" ? "success" : "orange"} />
        <h2 id="export-title" className="type-heading text-ink">
          {text.title}
        </h2>
      </div>
      <p className="type-body max-w-reading text-ink-2">{text.intro}</p>
      {state === "idle" ? (
        <Button type="button" variant="outline" aria-disabled={busy} data-export-request onClick={() => !busy && onRequest()}>
          <FileText aria-hidden />
          {text.request}
        </Button>
      ) : state === "ready" ? (
        <div className="space-y-3">
          <p role="status" className="flex items-center gap-2 font-medium text-success" data-export-ready>
            {text.ready}
          </p>
          <Button type="button" aria-disabled={busy} data-export-download onClick={() => !busy && onDownload()}>
            <Download aria-hidden />
            {downloading ? text.downloading : text.download}
          </Button>
        </div>
      ) : (
        <p role="status" className="flex items-center gap-3 text-ink" data-export-pending>
          <DialLoader className="size-6 text-orange-text" />
          {text.preparing}
        </p>
      )}
      {error ? <ApiErrorMessage error={error} /> : null}
    </section>
  );
}
