import type { Metadata } from "next";
import { Suspense } from "react";

import { CompanyProfileView } from "@/components/company/profile-view";
import { LoadingState } from "@/components/states/loading-state";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.companyProfile };

export default function CompanyProfilePage() {
  return (
    // useSearchParams (the chosen company) needs a Suspense boundary.
    <Suspense fallback={<LoadingState lines={3} className="mx-auto w-full max-w-3xl px-4 py-12" />}>
      <CompanyProfileView />
    </Suspense>
  );
}
