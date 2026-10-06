"use client";

import { ExportPanel } from "@/components/requests/offer-export";
import { ApiError } from "@/lib/api/errors";
import { messages } from "@/messages";

const failure = new ApiError({ status: 503, code: "service_unavailable", message: messages.design.navigation.exportFailed });
const nothing = () => undefined;

/** The four looks of the "Keep a copy" section side by side, for the design page. */
export function ExportDemo() {
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-export-sample>
      <ExportPanel started={false} ready={false} busy={false} downloading={false} error={null} onRequest={nothing} onDownload={nothing} />
      <ExportPanel started ready={false} busy={false} downloading={false} error={null} onRequest={nothing} onDownload={nothing} />
      <ExportPanel started ready busy={false} downloading={false} error={null} onRequest={nothing} onDownload={nothing} />
      <ExportPanel started={false} ready={false} busy={false} downloading={false} error={failure} onRequest={nothing} onDownload={nothing} />
    </div>
  );
}
