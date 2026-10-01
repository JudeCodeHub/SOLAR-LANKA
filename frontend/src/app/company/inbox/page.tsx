import type { Metadata } from "next";
import { Suspense } from "react";

import { InboxView } from "@/components/company/inbox-view";
import { LoadingState } from "@/components/states/loading-state";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.companyInbox };

export default function CompanyInboxPage() {
  return (
    // useSearchParams (the company and page) needs a Suspense boundary.
    <Suspense fallback={<LoadingState lines={3} className="mx-auto w-full max-w-3xl px-4 py-12" />}>
      <InboxView />
    </Suspense>
  );
}
