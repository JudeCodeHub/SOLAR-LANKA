import type { ReactNode } from "react";

import { DashboardShell } from "@/components/shell/dashboard-shell";
import { getCurrentIdentity } from "@/lib/auth/server";

/** The company workspace: its links beside every page under /company. */
export default async function CompanyLayout({ children }: { children: ReactNode }) {
  const { isSignedIn } = await getCurrentIdentity();
  return (
    <DashboardShell group="company" signedIn={isSignedIn}>
      {children}
    </DashboardShell>
  );
}
