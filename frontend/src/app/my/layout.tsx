import type { ReactNode } from "react";

import { DashboardShell } from "@/components/shell/dashboard-shell";
import { getCurrentIdentity } from "@/lib/auth/server";

/** The customer area: its links beside every page under /my. */
export default async function MyLayout({ children }: { children: ReactNode }) {
  const { isSignedIn } = await getCurrentIdentity();
  return (
    <DashboardShell group="customer" signedIn={isSignedIn}>
      {children}
    </DashboardShell>
  );
}
