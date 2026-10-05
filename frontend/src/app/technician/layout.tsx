import type { ReactNode } from "react";

import { DashboardShell } from "@/components/shell/dashboard-shell";
import { getCurrentIdentity } from "@/lib/auth/server";

/** The technician workspace shares the company links the technician may see. */
export default async function TechnicianLayout({ children }: { children: ReactNode }) {
  const { isSignedIn } = await getCurrentIdentity();
  return (
    <DashboardShell group="company" signedIn={isSignedIn}>
      {children}
    </DashboardShell>
  );
}
