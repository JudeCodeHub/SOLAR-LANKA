import type { Metadata } from "next";
import { Suspense } from "react";

import { InstallationsView } from "@/components/installations/installations-view";
import { LoadingState } from "@/components/states/loading-state";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.myInstallations };

export default function InstallationsPage() {
  return (
    // useSearchParams (the page number) needs a Suspense boundary.
    <Suspense fallback={<LoadingState lines={3} className="mx-auto w-full max-w-3xl px-4 py-12" />}>
      <InstallationsView />
    </Suspense>
  );
}
