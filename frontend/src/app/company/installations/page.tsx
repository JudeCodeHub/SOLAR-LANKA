import type { Metadata } from "next";
import { Suspense } from "react";

import { CompanyInstallationsView } from "@/components/company/installations-view";
import { LoadingState } from "@/components/states/loading-state";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.companyInstallations };

export default function CompanyInstallationsPage() {
  return (
    // useSearchParams (the company and page) needs a Suspense boundary.
    <Suspense fallback={<LoadingState lines={3} className="mx-auto w-full max-w-3xl px-4 py-12" />}>
      <CompanyInstallationsView />
    </Suspense>
  );
}
