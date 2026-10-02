import type { Metadata } from "next";
import { Suspense } from "react";

import { AccountAccess } from "@/components/admin/account-access";
import { LoadingState } from "@/components/states/loading-state";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.adminUsers };

export default function AdminUsersPage() {
  return (
    // useSearchParams (a prefilled account id) needs a Suspense boundary.
    <Suspense fallback={<LoadingState lines={3} className="mx-auto w-full max-w-3xl px-4 py-12" />}>
      <AccountAccess />
    </Suspense>
  );
}
