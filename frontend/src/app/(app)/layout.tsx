import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { sidebarFor } from "@/lib/navigation";

/** Every signed-in page lives in this frame: the sidebar of categories for this person, and the top strip. Signed-out visitors never get here (the proxy sends them to sign-in first). If the API cannot say who the person is, the sidebar shows only what every signed-in person gets. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const current = await getCurrentUser();
  const ready = current.status === "ready" ? current : null;
  return (
    <AppShell categories={sidebarFor(ready?.user ?? null, true)} persona={ready?.persona ?? null}>
      {children}
    </AppShell>
  );
}
