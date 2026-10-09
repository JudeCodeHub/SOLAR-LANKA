import type { Metadata } from "next";
import { Suspense } from "react";

import { ActivityView } from "@/components/admin/activity-view";
import { LoadingState } from "@/components/states/loading-state";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.adminActivity };

export default function AdminActivityPage() {
  return (
    // useSearchParams (the company filter and page) needs a Suspense boundary.
    <Suspense fallback={<LoadingState lines={3} className="mx-auto w-full max-w-3xl px-4 py-12" />}>
      <ActivityView />
    </Suspense>
  );
}
