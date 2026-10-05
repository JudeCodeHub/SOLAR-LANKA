import type { ReactNode } from "react";

import { DashboardShell } from "@/components/shell/dashboard-shell";
import { getCurrentIdentity } from "@/lib/auth/server";

/** The administration area: its links beside every page under /admin. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { isSignedIn } = await getCurrentIdentity();
  return (
    <DashboardShell group="admin" signedIn={isSignedIn}>
      {children}
    </DashboardShell>
  );
}
