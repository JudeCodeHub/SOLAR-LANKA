import type { Metadata } from "next";
import { Suspense } from "react";

import { CompanySupport } from "@/components/support/company-support";
import { LoadingState } from "@/components/states/loading-state";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.companySupport };

export default function CompanySupportPage() {
  return (
    <Suspense fallback={<LoadingState lines={3} className="mx-auto w-full max-w-3xl px-4 py-12" />}>
      <CompanySupport />
    </Suspense>
  );
}
