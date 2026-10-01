import type { Metadata } from "next";
import { Suspense } from "react";

import { RequestsView } from "@/components/requests/requests-view";
import { LoadingState } from "@/components/states/loading-state";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.myRequests };

export default function RequestsPage() {
  return (
    // useSearchParams (the page number) needs a Suspense boundary.
    <Suspense fallback={<LoadingState lines={3} className="mx-auto w-full max-w-3xl px-4 py-12" />}>
      <RequestsView />
    </Suspense>
  );
}
