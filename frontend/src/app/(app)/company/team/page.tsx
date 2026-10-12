import type { Metadata } from "next";
import { Suspense } from "react";

import { TeamView } from "@/components/company/team-view";
import { LoadingState } from "@/components/states/loading-state";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.team };

export default function TeamPage() {
  return (
    // useSearchParams (the chosen company) needs a Suspense boundary.
    <Suspense fallback={<LoadingState lines={3} className="mx-auto w-full max-w-3xl px-4 py-12" />}>
      <TeamView />
    </Suspense>
  );
}
