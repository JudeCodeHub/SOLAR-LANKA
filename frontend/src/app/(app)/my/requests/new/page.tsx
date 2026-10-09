import type { Metadata } from "next";
import { Suspense } from "react";

import { PrepareView } from "@/components/requests/prepare-view";
import { LoadingState } from "@/components/states/loading-state";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.prepareRequest };

export default function PrepareRequestPage() {
  return (
    // useSearchParams (the chosen estimate) needs a Suspense boundary.
    <Suspense fallback={<LoadingState lines={3} className="mx-auto w-full max-w-3xl px-4 py-12" />}>
      <PrepareView />
    </Suspense>
  );
}
