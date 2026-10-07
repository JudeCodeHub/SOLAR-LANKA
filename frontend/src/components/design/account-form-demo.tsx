"use client";

import { Suspense } from "react";

import { AccountForm } from "@/components/admin/account-access";

/** The account-access form for the design page; a bad id is refused before any question, so nothing here reaches the API. */
export function AccountFormDemo() {
  return (
    <div className="max-w-3xl" data-account-sample>
      <Suspense fallback={null}>
        <AccountForm selfId="11111111-1111-4111-8111-111111111111" />
      </Suspense>
    </div>
  );
}
