import type { Metadata } from "next";
import { Suspense } from "react";

import { CompanyDashboard } from "@/components/dashboard/company-dashboard";
import { LoadingState } from "@/components/states/loading-state";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.companyDashboard };

export default function CompanyDashboardPage() {
  return (
    // useSearchParams (the company) needs a Suspense boundary.
    <Suspense fallback={<LoadingState lines={3} className="mx-auto w-full max-w-3xl px-4 py-12" />}>
      <CompanyDashboard />
    </Suspense>
  );
}
