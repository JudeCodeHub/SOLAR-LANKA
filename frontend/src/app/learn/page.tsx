import type { Metadata } from "next";
import { Suspense } from "react";

import { LearnView } from "@/components/education/learn-view";
import { LoadingState } from "@/components/states/loading-state";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.learn };

export default function LearnPage() {
  return (
    // useSearchParams (the search, topic and page) needs a Suspense boundary.
    <Suspense fallback={<LoadingState lines={3} className="mx-auto w-full max-w-3xl px-4 py-12" />}>
      <LearnView />
    </Suspense>
  );
}
